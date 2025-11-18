"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const setMyName = useMutation(api.users.setMyName);
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-form-field"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).then(async () => {
            // If signing up, persist the display name to users table
            if (flow === "signUp") {
              try {
                const name = (formData.get("name") as string) || "";
                if (name.trim()) {
                  try {
                    await setMyName({ name });
                  } catch (e1) {
                    // Retry once after a short delay in case session hasn’t materialized yet
                    await new Promise((r) => setTimeout(r, 200));
                    await setMyName({ name });
                  }
                  toast.success("Profile name saved");
                }
              } catch (err) {
                toast.error("Signed up, but failed to save name. You can update it later in your profile.");
              }
            }
            setSubmitting(false);
          }).catch((error) => {
            let toastTitle = "";
            if (error.message.includes("Invalid password")) {
              toastTitle = "Invalid password. Please try again.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Could not sign in, did you mean to sign up?"
                  : "Could not sign up, did you mean to sign in?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        {flow === "signUp" && (
          <input
            className="auth-input-field"
            type="text"
            name="name"
            placeholder="Name"
            required
          />
        )}
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="Email"
          required
        />
        
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder="Password"
          required
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
        {/* {flow === "signIn" && (
          <button
            type="button"
            className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer text-sm self-start"
            disabled={resetting}
            onClick={async () => {
              try {
                setResetting(true);
                const formEl = (document.activeElement as HTMLElement)?.closest("form") as HTMLFormElement | null;
                const emailInput = formEl?.querySelector('input[name="email"]') as HTMLInputElement | null;
                const email = emailInput?.value?.trim();
                if (!email) {
                  toast.error("Enter your email to reset password");
                  setResetting(false);
                  return;
                }
                const fd = new FormData();
                fd.set("flow", "reset");
                fd.set("email", email);
                await signIn("password", fd);
                toast.success("If an account exists, a reset email has been sent.");
              } catch (err) {
                toast.error("Could not start password reset. Please contact support if this persists.");
              } finally {
                setResetting(false);
              }
            }}
          >
            {resetting ? "Requesting reset…" : "Forgot password?"}
          </button>
        )} */}
        <div className="text-center text-sm text-secondary">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
      {/* <div className="flex items-center justify-center my-3">
        <hr className="my-4 grow border-gray-200" />
        <span className="mx-4 text-secondary">or</span>
        <hr className="my-4 grow border-gray-200" />
      </div> */}
      {/* <button className="auth-button" onClick={() => void signIn("anonymous")}>
        Sign in anonymously
      </button> */}
    </div>
  );
}
