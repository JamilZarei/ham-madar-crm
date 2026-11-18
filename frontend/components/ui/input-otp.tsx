"use client";

import { OTPInput, OTPInputContext } from "input-otp";
import { useContext } from "react";
import { cn, faDigits } from "@shared/utils";

export function InputOTP(props: React.ComponentProps<typeof OTPInput>) {
  return <OTPInput data-slot="input-otp" containerClassName="otp-group" {...props} />;
}
export function InputOTPSlot({ index }: { index: number }) {
  const slot = useContext(OTPInputContext)?.slots[index];
  return <div data-slot="input-otp-slot" className={cn("otp-slot", slot?.isActive && "otp-active")}>
    {slot?.char && faDigits(slot.char)}{slot?.hasFakeCaret && <i />}
  </div>;
}
