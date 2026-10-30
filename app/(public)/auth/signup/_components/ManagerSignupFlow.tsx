"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile, deleteUser } from "firebase/auth";
import { doc, getDoc, writeBatch, collection } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { checkUsernameUnique } from "@/services/userService";
import { suggestUsername } from "@/lib/googleAuth";
import { getSsoReturnTo, completeSsoRedirect } from "@/lib/sso";
import toast from "react-hot-toast";
import {
  Step1Auth, UsernameField, TermsAgreement, WizardHeader, WizardFooter, SignupDone, StepFade,
  passwordError, usernameFormatError, step1ErrorFor, formatUzPhone, slugify, isValidSlug, pauseOnDone,
  type FieldErr,
} from "./FormSteps";
import { FloatField, FloatSelect, FieldError, FieldHint } from "../../_components/Field";
import { roleHome } from "../../_components/roleHome";
import { rememberLoginMethod } from "../../_components/lastLogin";

const validatePhone = (p: string) => /^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/.test(p);

// 🟢 MANAGER STEP 2: PERSONAL PROFILE
const Step2ManagerProfile = ({ formData, handleChange, usernameError, usernameAvailable, isCheckingUser, fieldError, t }: any) => {
  const phoneErr = fieldError?.field === "phone" ? fieldError.text : null;
  return (
    <div className="space-y-5">
      <FloatField id="su-fullname" name="fullName" type="text" autoComplete="name" label={t.inputs.fullname} required value={formData.fullName} onChange={handleChange} autoFocus />

      <UsernameField formData={formData} handleChange={handleChange} usernameError={usernameError} usernameAvailable={usernameAvailable} isCheckingUser={isCheckingUser} t={t} />

      {/* "+998" is a fixed prefix; the input holds only the local part and is
          formatted as you type (formData.phone keeps the full number) */}
      <div>
        <FloatField
          id="su-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" required
          label={t.inputs.phone} prefix="+998" tone={phoneErr ? "error" : "idle"}
          value={formData.phone.replace(/^\+998\s?/, "")} onChange={handleChange}
        />
        {phoneErr ? <FieldError text={phoneErr} /> : <FieldHint>{t.hints.phone}</FieldHint>}
      </div>
    </div>
  );
};

// 🟢 MANAGER STEP 3: CENTER PROFILE
const Step3CenterProfile = ({ formData, handleChange, fieldError, t }: any) => {
  const slugErr = fieldError?.field === "centerSlug" ? fieldError.text : null;
  return (
    <div className="space-y-5">
      <FloatField id="su-center" name="centerName" type="text" autoComplete="organization" label={t.inputs.centerName} required value={formData.centerName} onChange={handleChange} autoFocus />

      <div>
        <FloatField
          id="su-slug" name="centerSlug" type="text" autoCapitalize="none" spellCheck={false} required
          label={t.inputs.centerSlug} value={formData.centerSlug} onChange={handleChange}
          tone={slugErr ? "error" : "idle"} className="font-mono"
        />
        {slugErr ? <FieldError text={slugErr} /> : <FieldHint>{t.hints.slug}</FieldHint>}
      </div>

      <FloatSelect id="su-size" name="studentCount" label={t.inputs.studentCount} value={formData.studentCount} onChange={handleChange} required>
        <option value="1-50">1-50</option>
        <option value="51-200">51-200</option>
        <option value="200-500">200-500</option>
        <option value="500+">500+</option>
      </FloatSelect>

      <TermsAgreement formData={formData} handleChange={handleChange} t={t} />
    </div>
  );
};

// googleMode: the user is already authenticated via Google (complete-profile
// page) — step 1 (email/password) is skipped, making this a 2-step wizard
// (profile → center); the account comes from auth.currentUser.
export default function ManagerSignupFlow({ onBack, t, googleMode = false }: any) {
  const router = useRouter();
  const [step, setStep] = useState(googleMode ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<FieldErr>(null);
  const [done, setDone] = useState(false);
  // The slug follows the center name until the user edits it by hand
  const [slugTouched, setSlugTouched] = useState(false);

  // Enterprise Username Checking State
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const cache = useRef(new Map<string, boolean>());

  const [formData, setFormData] = useState(() => ({
    email: "", password: "",
    fullName: (googleMode && auth.currentUser?.displayName) || "",
    username: googleMode ? suggestUsername(auth.currentUser?.email ?? null) : "",
    phone: "",
    centerName: "", centerSlug: "", studentCount: "",
    agreed: false
  }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (fieldError?.field === name || (name === "centerName" && !slugTouched)) setFieldError(null);

    if (type === "checkbox") {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else if (name === "phone") {
      setFormData(prev => ({ ...prev, phone: formatUzPhone(value) }));
    } else if (name === "centerName") {
      setFormData(prev => ({ ...prev, centerName: value, ...(slugTouched ? {} : { centerSlug: slugify(value) }) }));
    } else if (name === "centerSlug") {
      const slug = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      // Clearing the field hands the slug back to the center name
      setSlugTouched(slug !== "");
      setFormData(prev => ({ ...prev, centerSlug: slug || slugify(prev.centerName) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
      if (!formData.fullName || !formData.username || !formData.phone) return toast.error(t.validation.fillAll);
      if (usernameError || usernameAvailable === false) return toast.error(t.validation.userTaken);
      if (!validatePhone(formData.phone)) return setFieldError({ field: "phone", text: t.validation.phone });
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!formData.centerName || !formData.centerSlug || !formData.studentCount) return toast.error(t.validation.fillAll);
      if (!isValidSlug(formData.centerSlug)) return setFieldError({ field: "centerSlug", text: t.validation.slug });
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

      const centerRef = doc(collection(db, 'centers'));
      const centerId = centerRef.id;

      // 1. Center Payload
      batch.set(centerRef, {
        id: centerId,
        name: formData.centerName,
        slug: formData.centerSlug,
        ownerUid: user.uid,
        size: formData.studentCount,
        // New centers wait for super-admin approval; rules enforce 'pending' here.
        status: "pending",
        subscription: {
          plan: "free_trial",
          validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        },
        createdAt: new Date().toISOString()
      });

      // 2. Manager User Payload
      batch.set(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email,
        username: lowerUsername,
        displayName: formData.fullName,
        // Google avatar; optional fields are built conditionally — never write undefined
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
        phone: formData.phone,
        role: "manager",
        centerId: centerId,
        createdAt: new Date().toISOString(),
      });

      // 3. Username Payload
      batch.set(doc(db, "usernames", lowerUsername), { uid: user.uid });

      // 4. Contact details — owner-only subcollection, because the parent users/{uid}
      // doc is readable by every signed-in user (docs/AUTH.md). The email/phone above
      // are a migration mirror and go away with DEPLOY 2.
      batch.set(doc(db, "users", user.uid, "private", "contact"), {
        email: email,
        phone: formData.phone,
      });

      // Execute Write
      await batch.commit();

      rememberLoginMethod(googleMode ? "google" : "password");
      setDone(true);
      await pauseOnDone();
      // SSO: a partner app sent this user here — bounce back signed in
      const ssoReturnTo = getSsoReturnTo();
      if (ssoReturnTo && (await completeSsoRedirect(ssoReturnTo))) return;
      router.push("/manager/dashboard");
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

  // googleMode skips step 1, so its steps 2–3 are shown as 1–2 of 2
  const shownStep = googleMode ? step - 1 : step;
  const totalSteps = googleMode ? 2 : 3;

  if (done) return <SignupDone role="manager" t={t} />;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <WizardHeader
        n={shownStep} total={totalSteps}
        title={step === 3 ? t.steps.center.title : googleMode ? t.steps.google.title : t.steps[step].title}
        t={t}
      />

      <StepFade step={step}>
        {step === 1 && <Step1Auth formData={formData} handleChange={handleChange} showPassword={showPassword} setShowPassword={setShowPassword} fieldError={fieldError} t={t} />}
        {step === 2 && <Step2ManagerProfile formData={formData} handleChange={handleChange} usernameError={usernameError} usernameAvailable={usernameAvailable} isCheckingUser={isCheckingUser} fieldError={fieldError} t={t} />}
        {step === 3 && <Step3CenterProfile formData={formData} handleChange={handleChange} fieldError={fieldError} t={t} />}
      </StepFade>

      <WizardFooter
        onBack={() => (step === 1 || (googleMode && step === 2)) ? onBack() : setStep(step - 1)}
        loading={loading}
        isLast={step === 3}
        disabled={loading || (step === 2 && (isCheckingUser || usernameError !== null || usernameAvailable === false))}
        t={t}
      />
    </form>
  );
}
