import type { Metadata } from "next";

import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Register as a candidate — SIORP",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
