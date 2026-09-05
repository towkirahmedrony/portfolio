"use client";

import { useState } from "react";
import { LoginPanel } from "@/components/auth/login-form";
import { SignupPanel } from "@/components/auth/signup-form";
import { Modal } from "@/components/ui/modal";
import { PLACE_ORDER_NEXT_PATH } from "@/lib/auth";

type Mode = "login" | "signup";

type Props = {
  onClose: () => void;
  onAuthenticated: () => void;
  onBeforeOAuth: () => void;
};

export function PlaceOrderAuthModal({
  onClose,
  onAuthenticated,
  onBeforeOAuth,
}: Props) {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <Modal
      title="Login required"
      description="Please log in or create an account to submit your project request. Your completed form will be saved and restored automatically after authentication."
      onClose={onClose}
    >
      {mode === "login" ? (
        <LoginPanel
          nextPath={PLACE_ORDER_NEXT_PATH}
          placeOrder
          embedded
          idPrefix="place-order-login-"
          onSuccess={onAuthenticated}
          onSwitchToSignup={() => setMode("signup")}
          onBeforeOAuth={onBeforeOAuth}
        />
      ) : (
        <SignupPanel
          nextPath={PLACE_ORDER_NEXT_PATH}
          placeOrder
          embedded
          idPrefix="place-order-signup-"
          onSuccess={onAuthenticated}
          onSwitchToLogin={() => setMode("login")}
          onBeforeOAuth={onBeforeOAuth}
        />
      )}
    </Modal>
  );
}
