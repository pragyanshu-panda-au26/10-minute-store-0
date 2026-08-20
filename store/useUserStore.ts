import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Customer session + address book.
 *
 * The address book is persisted to the server for authenticated customers
 * (`/api/customers/me/addresses`) but also mirrored to localStorage for guests
 * so a not-yet-signed-in user can still stage a delivery address. On sign-in
 * the store hydrates from the server and starts using the server as truth.
 */

/**
 * Render an Address into a single "line" for display, gracefully skipping
 * blank city / pincode / area segments (a GPS-derived address may have them
 * empty until the user reverse-geocodes or edits the address).
 */
export function formatAddress(addr: Pick<Address, "houseNo" | "area" | "city" | "pincode">): string {
  const cityLine = [addr.city, addr.pincode].filter((s) => (s || "").trim()).join(" - ");
  return [addr.houseNo, addr.area, cityLine].filter((s) => (s || "").trim()).join(", ");
}

export interface Address {
  id: string;
  label: string;
  houseNo: string;
  area: string;
  city: string;
  pincode: string;
  isDefault?: boolean;
  lat?: number;
  lng?: number;
  landmark?: string;
  contactName?: string;
  contactPhone?: string;
}

export interface UserProfile {
  id?: string;
  name: string;
  phone: string;
  email: string;
  addresses: Address[];
  // null while the customer has no saved addresses (fresh account or guest).
  activeAddressId: string | null;
}

interface UserStore {
  isLoggedIn: boolean;
  hydrating: boolean;
  profile: UserProfile;
  hydrateSession: () => Promise<void>;
  applySession: (user: { id: string; name?: string | null; phone: string; email?: string | null; addresses?: Address[] }) => void;

  updateProfile: (fields: Partial<Omit<UserProfile, "addresses" | "activeAddressId">>) => void;
  addAddress: (address: Omit<Address, "id">) => Promise<Address | null>;
  updateAddress: (id: string, fields: Partial<Address>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setActiveAddress: (id: string) => void;
  getActiveAddress: () => Address;
  setGpsLocation: (lat: number, lng: number, areaName?: string) => Address;
  signOut: () => Promise<void>;
}

/**
 * An EMPTY placeholder address. Rendered as `— Add delivery address —` in the
 * checkout / cart. Used only when the address list is empty — never persisted,
 * never sent to the server. Previously we shipped a hardcoded "Flat 402,
 * Royal Palms, Patia, Bhubaneswar" here, which meant every guest and every
 * signed-in customer with no saved address saw somebody else's address
 * pre-filled at checkout.
 */
const EMPTY_ADDRESS: Address = {
  id: "addr_empty",
  label: "No address selected",
  houseNo: "",
  area: "",
  city: "",
  pincode: "",
};
const GUEST_ADDRESSES: Address[] = [];

const GUEST_PROFILE: UserProfile = {
  name: "Guest",
  phone: "",
  email: "",
  addresses: GUEST_ADDRESSES,
  activeAddressId: null,
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Request failed");
  return data as T;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      hydrating: true,
      profile: GUEST_PROFILE,

      hydrateSession: async () => {
        set({ hydrating: true });
        try {
          const res = await fetch("/api/auth/me", { credentials: "include" });
          if (!res.ok) {
            set({ hydrating: false });
            return;
          }
          const data = await res.json();
          if (!data.success || data.user?.role !== "customer") {
            set({ hydrating: false });
            return;
          }
          get().applySession(data.user);
        } catch {
          // silently ignore — user just isn't signed in yet
        } finally {
          set({ hydrating: false });
        }
      },

      applySession: (user) => {
        const serverAddrs = (user.addresses ?? []) as Address[];
        const currentActive = get().profile.activeAddressId;
        const addresses = serverAddrs.length > 0 ? serverAddrs : GUEST_ADDRESSES;
        const activeAddressId =
          addresses.find((a) => a.id === currentActive)?.id ??
          addresses.find((a) => a.isDefault)?.id ??
          addresses[0]?.id ??
          null;
        set({
          isLoggedIn: true,
          profile: {
            id: user.id,
            name: user.name ?? "Customer",
            phone: user.phone,
            email: user.email ?? "",
            addresses,
            activeAddressId,
          },
        });
      },

      updateProfile: (fields) => {
        set({ profile: { ...get().profile, ...fields } });
      },

      addAddress: async (newAddr) => {
        if (!get().isLoggedIn) {
          // guest: just save locally
          const id = "addr_" + Date.now();
          const created: Address = { ...newAddr, id };
          set({
            profile: {
              ...get().profile,
              addresses: [...get().profile.addresses, created],
              activeAddressId: id,
            },
          });
          return created;
        }
        try {
          const data = await api<{ address: Address }>("/api/customers/me/addresses", {
            method: "POST",
            body: JSON.stringify(newAddr),
          });
          set({
            profile: {
              ...get().profile,
              addresses: [...get().profile.addresses, data.address],
              activeAddressId: data.address.id,
            },
          });
          return data.address;
        } catch (err) {
          console.error("addAddress failed:", err);
          return null;
        }
      },

      updateAddress: async (id, fields) => {
        // optimistic
        const prev = get().profile.addresses;
        set({
          profile: {
            ...get().profile,
            addresses: prev.map((a) => (a.id === id ? { ...a, ...fields } : a)),
          },
        });
        if (!get().isLoggedIn) return;
        try {
          await api(`/api/customers/me/addresses/${id}`, {
            method: "PATCH",
            body: JSON.stringify(fields),
          });
        } catch {
          set({ profile: { ...get().profile, addresses: prev } });
        }
      },

      deleteAddress: async (id) => {
        const prev = get().profile.addresses;
        const remaining = prev.filter((a) => a.id !== id);
        const currentActive = get().profile.activeAddressId;
        set({
          profile: {
            ...get().profile,
            addresses: remaining,
            activeAddressId: currentActive === id ? remaining[0]?.id ?? null : currentActive,
          },
        });
        if (!get().isLoggedIn) return;
        try {
          await api(`/api/customers/me/addresses/${id}`, { method: "DELETE" });
        } catch {
          set({ profile: { ...get().profile, addresses: prev } });
        }
      },

      setActiveAddress: (id) =>
        set({ profile: { ...get().profile, activeAddressId: id } }),

      getActiveAddress: () => {
        const { addresses, activeAddressId } = get().profile;
        const found = addresses.find((a) => a.id === activeAddressId);
        // Fall through to EMPTY_ADDRESS (blank fields, "No address selected"
        // label) rather than a fake demo address so the checkout UI can show
        // an "Add address" prompt instead of pretending one exists.
        return found || addresses[0] || EMPTY_ADDRESS;
      },

      setGpsLocation: (lat, lng, areaName) => {
        const fixedGpsId = "gps_current";
        // Never stamp a hardcoded city/pincode over a real GPS fix — that
        // would print "Bhubaneswar 751024" on a delivery going to Paradip
        // (or anywhere else). Leave them blank so the reverse-geocode step
        // (or the user editing the address) fills them in with real values.
        const gpsAddress: Address = {
          id: fixedGpsId,
          label: "Current GPS Location",
          houseNo: `GPS Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          area: areaName || "",
          city: "",
          pincode: "",
          lat,
          lng,
        };
        const otherAddresses = get().profile.addresses.filter(
          (a) => a.id !== fixedGpsId && a.label !== "Current GPS Location" && !a.id.startsWith("gps_")
        );
        set({
          profile: {
            ...get().profile,
            addresses: [gpsAddress, ...otherAddresses],
            activeAddressId: fixedGpsId,
          },
        });
        return gpsAddress;
      },

      signOut: async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } catch {}
        set({ isLoggedIn: false, profile: GUEST_PROFILE });
        // Wipe the persisted snapshot too — otherwise the next visit on a
        // shared browser rehydrates the previous account's name / phone /
        // addresses before the server session says "guest".
        try {
          if (typeof window !== "undefined") {
            localStorage.removeItem("satyug_user_profile_v2");
            // Also drop the cart — a new user on the same device shouldn't
            // inherit the previous user's basket.
            localStorage.removeItem("satyug_cart_v1");
            localStorage.removeItem("satyug_live_active_cart");
          }
        } catch {}
      },
    }),
    {
      name: "satyug_user_profile_v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // persist only the address book & active id (not isLoggedIn — that
        // is authoritative from server via cookie)
        profile: {
          addresses: state.profile.addresses,
          activeAddressId: state.profile.activeAddressId,
          name: state.profile.name,
          phone: state.profile.phone,
          email: state.profile.email,
        },
      }),
    }
  )
);
