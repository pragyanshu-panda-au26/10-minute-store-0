"use client";

import { useState } from "react";
import { useUserStore, Address } from "@/store/useUserStore";
import {
  X,
  User,
  MapPin,
  Phone,
  Mail,
  Plus,
  Edit2,
  Trash2,
  Check,
  Building,
  Home,
  Briefcase,
  Save,
  LogOut,
} from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const {
    profile,
    updateProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    setActiveAddress,
    signOut,
  } = useUserStore();

  const [activeTab, setActiveTab] = useState<"profile" | "addresses">("addresses");

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
  });
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);

  // Address Modal / Form State
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [editingAddr, setEditingAddr] = useState<Address | null>(null);

  const [addressForm, setAddressForm] = useState({
    label: "Home",
    houseNo: "",
    area: "",
    city: "Bhubaneswar, Odisha",
    pincode: "751024",
  });

  if (!isOpen) return null;

  // Handle Profile Save
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: profileForm.name.trim(),
      phone: profileForm.phone.trim(),
      email: profileForm.email.trim(),
    });
    setProfileSavedMsg(true);
    setTimeout(() => setProfileSavedMsg(false), 2500);
  };

  const handleSignOut = () => {
    if (confirm("Are you sure you want to sign out of your Satyug account?")) {
      signOut();
      onClose();
    }
  };

  // Handle Add Address Submit (Create)
  const handleAddAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAddress({
      label: addressForm.label,
      houseNo: addressForm.houseNo.trim(),
      area: addressForm.area.trim(),
      city: addressForm.city.trim(),
      pincode: addressForm.pincode.trim(),
    });

    setAddressForm({
      label: "Home",
      houseNo: "",
      area: "",
      city: "Bhubaneswar, Odisha",
      pincode: "751024",
    });
    setIsAddAddressOpen(false);
  };

  // Open Edit Address Modal (Update)
  const openEditAddrModal = (addr: Address) => {
    setEditingAddr(addr);
    setAddressForm({
      label: addr.label,
      houseNo: addr.houseNo,
      area: addr.area,
      city: addr.city,
      pincode: addr.pincode,
    });
  };

  // Handle Edit Address Submit (Update)
  const handleEditAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddr) return;

    updateAddress(editingAddr.id, {
      label: addressForm.label,
      houseNo: addressForm.houseNo.trim(),
      area: addressForm.area.trim(),
      city: addressForm.city.trim(),
      pincode: addressForm.pincode.trim(),
    });

    setEditingAddr(null);
  };

  // Handle Address Delete (Delete)
  const handleDeleteAddr = (id: string, label: string) => {
    if (confirm(`Delete saved address "${label}"?`)) {
      deleteAddress(id);
    }
  };

  const getLabelIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case "home":
        return <Home className="h-4 w-4 text-emerald-600" />;
      case "work":
        return <Briefcase className="h-4 w-4 text-blue-600" />;
      default:
        return <Building className="h-4 w-4 text-purple-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />

      {/* Main Modal Panel */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 font-bold">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Customer Profile & Address
              </h3>
              <p className="text-xs text-slate-500">
                Manage your personal info and delivery locations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 rounded-xl bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-6">
          <button
            onClick={() => setActiveTab("addresses")}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-xs font-bold transition-all ${
              activeTab === "addresses"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <MapPin className="h-4 w-4" />
            Delivery Addresses ({profile.addresses.length})
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-xs font-bold transition-all ${
              activeTab === "profile"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <User className="h-4 w-4" />
            Profile Details
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* TAB 1: DELIVERY ADDRESSES (CRUD) */}
          {activeTab === "addresses" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select Active Delivery Address
                </span>
                <button
                  onClick={() => {
                    setAddressForm({
                      label: "Home",
                      houseNo: "",
                      area: "",
                      city: "Bhubaneswar, Odisha",
                      pincode: "751024",
                    });
                    setIsAddAddressOpen(true);
                  }}
                  className="flex items-center gap-1 text-xs font-extrabold text-emerald-600 hover:text-emerald-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add New Address
                </button>
              </div>

              {/* Saved Address Cards */}
              <div className="space-y-2.5">
                {profile.addresses.map((addr) => {
                  const isActive = profile.activeAddressId === addr.id;
                  return (
                    <div
                      key={addr.id}
                      onClick={() => setActiveAddress(addr.id)}
                      className={`relative flex items-start justify-between rounded-2xl border p-4 cursor-pointer transition-all ${
                        isActive
                          ? "border-emerald-500 bg-emerald-50/60 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100">
                          {getLabelIcon(addr.label)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {addr.label}
                            </span>
                            {isActive && (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black text-white">
                                <Check className="h-2.5 w-2.5" /> ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-700 mt-1 font-medium">
                            {addr.houseNo}, {addr.area}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {addr.city} - {addr.pincode}
                          </p>
                        </div>
                      </div>

                      {/* Edit & Delete Action Buttons */}
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openEditAddrModal(addr)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          title="Edit Address"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {profile.addresses.length > 1 && (
                          <button
                            onClick={() => handleDeleteAddr(addr.id, addr.label)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                            title="Delete Address"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE DETAILS (CRUD) */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileSavedMsg && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-xs font-bold text-emerald-800 animate-in fade-in">
                  <Check className="h-4 w-4 text-emerald-600" />
                  Profile details updated successfully!
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, name: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, phone: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={profileForm.email}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, email: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white shadow-md hover:bg-emerald-500 active:scale-95 transition-all"
                >
                  <Save className="h-4 w-4" />
                  Save Profile Changes
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
