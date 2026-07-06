"use client";

import { useEffect, useRef, useState } from "react";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { useAuth } from "@/lib/AuthContext";
import {
  AtSign, Building2, Calendar, Camera, Check, Loader2,
  Mail, Phone, Trash2, User, X,
} from "lucide-react";
import toast from "react-hot-toast";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ManagerProfilePage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [centerName, setCenterName] = useState("");
  const [loading, setLoading] = useState(true);

  // Photo & cropper state — same flow as the teacher/student profile pages.
  const [isUploading, setIsUploading] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          if (data.centerId) {
            try {
              const centerSnap = await getDoc(doc(db, "centers", data.centerId));
              if (centerSnap.exists()) setCenterName(centerSnap.data().name || "");
            } catch { /* center name is cosmetic */ }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.addEventListener("load", () => setImgSrc(reader.result?.toString() || ""));
      reader.readAsDataURL(file);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const cropSize = Math.min(width, height) * 0.9;
    setCrop(centerCrop(makeAspectCrop({ unit: "px", width: cropSize }, 1, width, height), width, height));
  };

  const handleUploadCroppedImage = async () => {
    if (!completedCrop || !imgRef.current || !user || !selectedFile) return;

    setIsUploading(true);
    try {
      const canvas = document.createElement("canvas");
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

      let cropPixelWidth = completedCrop.width * scaleX;
      let cropPixelHeight = completedCrop.height * scaleY;

      // Smart compression thresholds — identical to the teacher/student pages.
      const originalKb = selectedFile.size / 1024;
      let outputQuality = 0.95;
      if (originalKb > 1024) {
        outputQuality = 0.75;
        if (cropPixelWidth > 800) {
          const ratio = 800 / cropPixelWidth;
          cropPixelWidth = 800;
          cropPixelHeight = cropPixelHeight * ratio;
        }
      } else if (originalKb > 200) {
        outputQuality = 0.85;
        if (cropPixelWidth > 1024) {
          const ratio = 1024 / cropPixelWidth;
          cropPixelWidth = 1024;
          cropPixelHeight = cropPixelHeight * ratio;
        }
      } else {
        outputQuality = 1.0;
      }

      canvas.width = cropPixelWidth;
      canvas.height = cropPixelHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No 2d context");

      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0, 0, canvas.width, canvas.height
      );

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas is empty"))), "image/jpeg", outputQuality);
      });

      const storageRef = ref(storage, `profile_images/${user.uid}.jpg`);
      await uploadBytes(storageRef, blob);

      const downloadUrl = await getDownloadURL(storageRef);
      const finalUrl = `${downloadUrl}&t=${Date.now()}`;

      await updateDoc(doc(db, "users", user.uid), { photoURL: finalUrl });
      await updateProfile(user, { photoURL: finalUrl });

      setProfile((prev: any) => ({ ...prev, photoURL: finalUrl }));
      toast.success("Rasm yangilandi!");

      setImgSrc("");
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
      toast.error("Rasm yuklashda xatolik");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async () => {
    if (!user) return;
    setIsUploading(true);
    try {
      try { await deleteObject(ref(storage, `profile_images/${user.uid}.jpg`)); } catch { /* ignore if missing */ }

      await updateDoc(doc(db, "users", user.uid), { photoURL: null });
      await updateProfile(user, { photoURL: "" });

      setProfile((prev: any) => ({ ...prev, photoURL: null }));
      setShowPhotoViewer(false);
      toast.success("Rasm o'chirildi!");
    } catch (error) {
      console.error(error);
      toast.error("O'chirishda xatolik");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-500 font-medium">
        Profil topilmadi.
      </div>
    );
  }

  const joinYear = profile.createdAt
    ? (profile.createdAt.toDate ? new Date(profile.createdAt.toDate()).getFullYear() : new Date(profile.createdAt).getFullYear())
    : "-";

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Hidden file input */}
      <input type="file" accept="image/jpeg, image/png, image/webp" ref={fileInputRef} className="hidden" onChange={onSelectFile} />

      {/* Cropper modal */}
      {imgSrc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => !isUploading && setImgSrc("")}></div>
          <div className="relative bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-slate-100 z-10 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-900">Rasmni Kesish</h3>
              <button onClick={() => setImgSrc("")} disabled={isUploading} className="text-slate-400 hover:text-slate-900 transition-colors"><X size={20} /></button>
            </div>

            <div className="w-full max-h-[60vh] overflow-hidden bg-slate-100 rounded-xl flex items-center justify-center mb-6">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
                className="max-h-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={imgSrc} alt="Crop preview" onLoad={onImageLoad} className="max-h-[60vh] object-contain" />
              </ReactCrop>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setImgSrc("")} disabled={isUploading} className="px-5 py-2.5 text-[14px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                Bekor qilish
              </button>
              <button onClick={handleUploadCroppedImage} disabled={isUploading} className="px-6 py-2.5 text-[14px] font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors shadow-sm shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2">
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">

        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            onClick={() => profile.photoURL && !isUploading ? setShowPhotoViewer(true) : null}
            className={`w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-amber-400 to-orange-400 shadow-lg shadow-amber-500/20 relative overflow-hidden transition-transform duration-300 ${profile.photoURL ? "cursor-pointer hover:scale-[1.02]" : ""}`}
          >
            <div className="w-full h-full bg-white rounded-full overflow-hidden flex items-center justify-center border-4 border-white relative">
              {profile.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoURL} alt="Profil rasmi" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-amber-700 bg-amber-50 w-full h-full flex items-center justify-center">
                  {getInitials(profile.displayName)}
                </span>
              )}
              {isUploading && <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin text-white" size={28} /></div>}
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Rasmni o'zgartirish"
            className="absolute bottom-1 right-1 w-10 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-full flex items-center justify-center border-4 border-white shadow-md transition-transform active:scale-90 disabled:opacity-50 z-10"
          >
            <Camera size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Identity */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <h1 className="text-2xl md:text-[28px] font-black text-slate-900 tracking-tight truncate">{profile.displayName || "Menejer"}</h1>
          {profile.username && <p className="text-slate-400 font-bold text-[14px] mt-0.5">@{profile.username}</p>}

          <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-[12px] font-bold rounded-lg border border-amber-100">
              <User size={13} /> Menejer
            </span>
            {centerName && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 text-[12px] font-bold rounded-lg">
                <Building2 size={13} /> {centerName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100/50"><Mail size={19} /></div>
            <h3 className="font-black text-slate-800 text-[15px]">Aloqa Ma&apos;lumotlari</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
              <p className="flex items-center gap-2 text-slate-800 font-bold text-[14px] truncate"><AtSign size={14} className="text-slate-400 shrink-0" /> {profile.email}</p>
            </div>
            <div className="h-px w-full bg-slate-100"></div>
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Telefon</p>
              <p className="flex items-center gap-2 text-slate-800 font-bold text-[14px]"><Phone size={14} className="text-slate-400 shrink-0" /> {profile.phone || <span className="text-slate-400 font-medium italic">Kiritilmagan</span>}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100/50"><Building2 size={19} /></div>
            <h3 className="font-black text-slate-800 text-[15px]">Markaz</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">O&apos;quv markazi</p>
              <p className="text-slate-800 font-bold text-[14px] truncate">{centerName || <span className="text-slate-400 font-medium italic">Kiritilmagan</span>}</p>
            </div>
            <div className="h-px w-full bg-slate-100"></div>
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Qo&apos;shilgan yili</p>
              <p className="flex items-center gap-2 text-slate-800 font-bold text-[14px]"><Calendar size={14} className="text-slate-400 shrink-0" /> {joinYear}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen photo viewer */}
      {showPhotoViewer && profile.photoURL && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={() => setShowPhotoViewer(false)}></div>
          <div className="relative w-full max-w-lg aspect-square rounded-[2rem] bg-black overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.photoURL} alt="Profil rasmi" className="w-full h-full object-cover" />
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
              <button onClick={() => setShowPhotoViewer(false)} className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 backdrop-blur-md transition-colors"><X size={20} strokeWidth={2.5} /></button>
              <button onClick={handleDeletePhoto} disabled={isUploading} className="w-10 h-10 rounded-full bg-black/40 text-red-400 hover:text-red-500 hover:bg-red-500/20 flex items-center justify-center backdrop-blur-md transition-colors disabled:opacity-50">
                {isUploading ? <Loader2 size={18} className="animate-spin text-white" /> : <Trash2 size={18} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
