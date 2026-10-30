"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile, deleteUser } from "firebase/auth";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { checkUsernameUnique } from "@/services/userService";
import { suggestUsername } from "@/lib/googleAuth";
import { getSsoReturnTo, completeSsoRedirect } from "@/lib/sso";
import toast from "react-hot-toast";
import {
  Step1Auth, Step2Profile, WizardHeader, WizardFooter, SignupDone, StepFade,
  passwordError, usernameFormatError, step1ErrorFor, pauseOnDone, type FieldErr,
} from "./FormSteps";
import { roleHome } from "../../_components/roleHome";
import { rememberLoginMethod } from "../../_components/lastLogin";

// googleMode: the user is already authenticated via Google (complete-profile
// page) — step 1 (email/password) is skipped entirely and the account comes
// from auth.currentUser instead of createUserWithEmailAndPassword.
export default function StudentSignupFlow({ onBack, t, googleMode = false }: any) {
  const router = useRouter();
  const [step, setStep] = useState(googleMode ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<FieldErr>(null);
  const [done, setDone] = useState(false);

  // Enterprise Username Checking State
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const cache = useRef(new Map<string, boolean>());

  const [formData, setFormData] = useState(() => ({
    email: "", password: "",
    fullName: (googleMode && auth.currentUser?.displayName) || "",
    username: googleMode ? suggestUsername(auth.currentUser?.email ?? null) : "",
    gradeLevel: "",
    agreed: false
  }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const v = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setFormData({ ...formData, [name]: v });
    if (fieldError?.field === name) setFieldError(null);
  };

  // Debounced Username Check
  useEffect(() => {
    const input = formData.username.trim().toLowerCase();
    setUsernameAvailable(null); setUsernameError(null);
    if (!input) return;

    const error = usernameFormatError(input, t);
    if (error) return setUsernameError(error);

    if (cache.current.has(input)) {
      setUsernameAvailable(cache.current.get(input)!);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsCheckingUser(true);
      try {
        const isUnique = await checkUsernameUnique(input);
        cache.current.set(input, isUnique);
        setUsernameAvailable(isUnique);
      } catch (err) { setUsernameAvailable(true); } 
      finally { setIsCheckingUser(false); }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [formData.username, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!formData.email || !formData.password) return toast.error(t.validation.fillAll);
      const pwdError = passwordError(formData.password, t);
      if (pwdError) return setFieldError({ field: "password", text: pwdError });
      setStep(2);
      return;
    }
    
    if (step === 2) {
      if (!formData.fullName || !formData.username || !formData.gradeLevel) return toast.error(t.validation.fillAll);
      if (usernameError || usernameAvailable === false) return toast.error(t.validation.userTaken);
      await handleSignup();
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    let user = null;
    try {
      let email: string;
      if (googleMode) {
        user = auth.currentUser;
        if (!user) { toast.error(t.validation.sessionExpired); router.push("/auth/login"); return; }
        // A profile may already exist (merged Google/password account, stale
        // tab). Overwriting it would reset XP/role data — redirect instead.
        const existing = await getDoc(doc(db, "users", user.uid));
        if (existing.exists()) {
          toast.success(t.validation.alreadyRegistered);
          router.push(roleHome(existing.data().role));
          return;
        }
        email = user.email || "";
        await updateProfile(user, { displayName: formData.fullName });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        user = userCredential.user;
        email = formData.email;
        await updateProfile(user, { displayName: formData.fullName });
      }

      const batch = writeBatch(db);
      const lowerUsername = formData.username.toLowerCase();

      // 🚀 TURBO STUDENT PAYLOAD
      batch.set(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email,
        username: lowerUsername,
        // Google avatar; optional fields are built conditionally — never write undefined
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
        displayName: formData.fullName, 
        role: "student", 
        grade: formData.gradeLevel,
        
        // Progressive Profiling Empty Fields (Ensures app doesn't crash on nulls)
        phone: "", 
        birthDate: "", 
        gender: "", 
        institution: "",
        location: { country: "Uzbekistan", region: "", district: "" },
        
        // App Logic Defaults
        totalXP: 0, 
        currentStreak: 0, 
        level: 1, 
        dailyHistory: {},
        progress: { completedTopicIndex: 0, completedChapterIndex: 0, completedSubtopicIndex: 0 },
        createdAt: new Date().toISOString(),
      });

      batch.set(doc(db, "usernames", lowerUsername), { uid: user.uid });

      // Contact details live in an owner-only subcollection — the parent users/{uid}
      // doc is readable by every signed-in user (docs/AUTH.md). The `email` above is
      // a migration mirror and goes away with DEPLOY 2.
      batch.set(doc(db, "users", user.uid, "private", "contact"), {
        email: email,
        phone: "",
      });

      // Execute Write
      await batch.commit();

      rememberLoginMethod(googleMode ? "google" : "password");
      setDone(true);
      await pauseOnDone();
      // SSO: a partner app sent this user here — bounce back signed in
      const ssoReturnTo = getSsoReturnTo();
      if (ssoReturnTo && (await completeSsoRedirect(ssoReturnTo))) return;
      router.push("/dashboard");
    } catch (error: any) {
      console.error("signup failed:", error);
      // 🛡️ Rollback auth if database write fails. Google accounts pre-exist and
      // onboarding is resumable (complete-profile), so never delete them.
      if (!googleMode && user && auth.currentUser) await deleteUser(auth.currentUser).catch(() => {});
      // Email/password problems → back to step 1, shown under the field
      const step1Err = googleMode ? null : step1ErrorFor(error.code, t);
      if (step1Err) {
        setFieldError(step1Err);
        setStep(1);
        return;
      }
      // permission-denied at signup ≈ the immutable usernames/{name} doc already
      // exists — the availability check fails open on network errors (docs/AUTH.md)
      toast.error(error.code === "permission-denied" ? t.validation.userTaken : t.validation.generic);
    } finally {
      setLoading(false);
    }
  };

  if (done) return <SignupDone role="student" t={t} />;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <WizardHeader
        n={step} total={googleMode ? 1 : 2}
        title={googleMode ? t.steps.google.title : t.steps[step].title}
        sub={googleMode ? t.steps.google.sub : undefined}
        t={t}
      />

      <StepFade step={step}>
        {step === 1 && <Step1Auth formData={formData} handleChange={handleChange} showPassword={showPassword} setShowPassword={setShowPassword} fieldError={fieldError} t={t} />}
        {step === 2 && <Step2Profile formData={formData} handleChange={handleChange} usernameError={usernameError} usernameAvailable={usernameAvailable} isCheckingUser={isCheckingUser} role="student" t={t} />}
      </StepFade>

      <WizardFooter
        onBack={() => (step === 1 || googleMode) ? onBack() : setStep(1)}
        loading={loading}
        isLast={step === 2}
        disabled={loading || (step === 2 && (isCheckingUser || usernameError !== null || usernameAvailable === false))}
        t={t}
      />
    </form>
  );
}
