"use client";

import { useState, useEffect, useRef } from "react";
import { useShellStore } from "@/lib/shell-store";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

/**
 * ConfirmDialogHost — renders exactly once (in page.tsx).
 * Replaces native window.confirm()/window.prompt() everywhere in the app
 * with a themed, RTL-aware dialog driven by the store's
 * requestConfirm()/requestPrompt() actions.
 */
export function ConfirmDialogHost() {
  const confirmDialog = useShellStore((s) => s.confirmDialog);
  const resolveConfirm = useShellStore((s) => s.resolveConfirm);
  const promptDialog = useShellStore((s) => s.promptDialog);
  const resolvePrompt = useShellStore((s) => s.resolvePrompt);

  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPromptValue(promptDialog?.defaultValue || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [promptDialog]);

  // H5 fix: if this host unmounts while a dialog is open (route change, app
  // shutdown, HMR), resolve pending promises so callers awaiting
  // requestConfirm/requestPrompt don't hang forever. Use a ref to hold the
  // LATEST state, so the unmount cleanup (registered once) sees current data.
  const latestRef = useRef({ confirmDialog, promptDialog, resolveConfirm, resolvePrompt });
  useEffect(() => {
    latestRef.current = { confirmDialog, promptDialog, resolveConfirm, resolvePrompt };
  });

  useEffect(() => {
    return () => {
      const { confirmDialog: cd, promptDialog: pd, resolveConfirm: rc, resolvePrompt: rp } = latestRef.current;
      if (cd) rc(false);
      if (pd) rp(null);
    };
  }, []); // run once on mount; cleanup once on unmount

  return (
    <>
      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) resolveConfirm(false); }}>
        <AlertDialogContent dir="rtl" className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title || "تأكيد"}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-start">
            <AlertDialogAction
              onClick={() => resolveConfirm(true)}
              className={confirmDialog?.danger ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              تأكيد
            </AlertDialogAction>
            <AlertDialogCancel onClick={() => resolveConfirm(false)}>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!promptDialog} onOpenChange={(open) => { if (!open) resolvePrompt(null); }}>
        <AlertDialogContent dir="rtl" className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>{promptDialog?.title || "أدخل قيمة"}</AlertDialogTitle>
            <AlertDialogDescription>{promptDialog?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoFocus
            type={promptDialog?.inputType || "text"}
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") resolvePrompt(promptValue);
            }}
            className="text-right"
          />
          <AlertDialogFooter className="sm:justify-start">
            <AlertDialogAction onClick={() => resolvePrompt(promptValue)}>
              تأكيد
            </AlertDialogAction>
            <AlertDialogCancel onClick={() => resolvePrompt(null)}>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
