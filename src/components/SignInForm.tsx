"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/auth-actions";

const initialState: SignInState = { status: "idle", message: "" };

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initialState);

  return (
    <form action={action} className="auth-sign-in-form">
      <label className="form-field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="form-field">
        <span>Kata sandi</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
      </button>
      {state.message && <p className="form-message is-error" role="alert">{state.message}</p>}
    </form>
  );
}
