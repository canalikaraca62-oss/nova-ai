"use client";

import { useEffect, useRef } from "react";

/*
  SYRAVEN — what a dialog owes a keyboard

  WHY THIS EXISTS

  Five reachable overlays in this product -- Add memory, Create New
  Task, Create a new team, Create new project, and the activity detail
  panel -- were plain divs with `fixed inset-0 z-50`. They looked like
  dialogs and behaved like nothing:

    - no role, so a screen reader announced no dialog had opened
    - no aria-modal, so the page behind stayed in the reading order
    - no labelled title, so the dialog had no accessible name
    - no Escape, so a keyboard user could not close four of them
    - no focus management, so Tab walked out of the dialog and into
      the page underneath while the dialog was still covering it
    - no focus restoration, so dismissing one dropped focus back to
      the top of the document

  app/components/ui/Modal.tsx already implements every one of those
  correctly. Nothing imports it, and converting five hand-rolled
  overlays to a full primitive is a large refactor with real
  regression risk on pages that work today.

  So the BEHAVIOUR is extracted here rather than reimplemented, and the
  markup stays where it is. The focusable-element selector and the Tab
  cycling below are Modal's, kept deliberately identical: two
  implementations of a focus trap that differ in small ways is how one
  of them ends up subtly wrong.

  WHAT THIS DOES NOT DO

  It does not render anything, and it does not manage open state. The
  caller already owns both. This adds only the keyboard and screen
  reader contract that was missing.
*/

/**
 * Everything inside `container` that can take focus.
 *
 * Mirrors Modal.tsx exactly. `tabIndex >= 0` filters out anything
 * removed from the tab order, and aria-hidden subtrees are skipped
 * because a screen reader is not being shown them either.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    'input:not([disabled]):not([type="hidden"])',
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(",");

  return Array.from(
    container.querySelectorAll<HTMLElement>(selector),
  ).filter((element) => {
    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    return !element.hasAttribute("disabled") && element.tabIndex >= 0;
  });
}

export interface DialogBehaviourOptions {
  /** Whether the dialog is currently on screen. */
  readonly open: boolean;
  /** Called for Escape, and for nothing else. */
  readonly onClose: () => void;
  /**
   * The dialog panel — NOT the backdrop.
   *
   * The trap cycles within this element, so pointing it at the
   * full-screen overlay would include anything the overlay happens to
   * contain outside the panel.
   */
  readonly panelRef: React.RefObject<HTMLElement | null>;
  /**
   * Set false for a dialog that must be answered rather than
   * dismissed. Defaults to true, because most can be.
   */
  readonly closeOnEscape?: boolean;
}

/**
 * Gives a hand-rolled overlay the keyboard behaviour of a dialog.
 *
 * Escape closes it, Tab cycles inside it, the page behind stops
 * scrolling, and focus returns to whatever opened it.
 */
export function useDialogBehaviour({
  open,
  onClose,
  panelRef,
  closeOnEscape = true,
}: DialogBehaviourOptions): void {
  /*
    Held in a ref rather than state: changing it must never cause a
    render, and it has to survive the renders that happen while the
    dialog is open.
  */
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  /*
    The latest onClose, without making it an effect dependency.

    A caller that passes an inline arrow -- which every one of these
    pages does -- would otherwise tear down and re-establish the
    listener on every render, and with it the saved focus target.
  */
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    if (
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return undefined;
    }

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /*
      Move focus into the dialog on open.

      Without this the first Tab goes to whatever followed the trigger
      in the document, which is behind the overlay. Preferring the
      first focusable control over the panel itself means a keyboard
      user lands on something they can act on.
    */
    const panel = panelRef.current;

    if (panel) {
      const focusable = getFocusableElements(panel);
      const first = focusable[0];

      if (first) {
        first.focus();
      } else {
        panel.setAttribute("tabindex", "-1");
        panel.focus();
      }
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const container = panelRef.current;
      if (!container) return;

      const focusableElements = getFocusableElements(container);

      if (focusableElements.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      /* Strict mode with noUncheckedIndexedAccess. */
      if (!firstElement || !lastElement) {
        event.preventDefault();
        container.focus();
        return;
      }

      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (
          activeElement === firstElement ||
          !container.contains(activeElement)
        ) {
          event.preventDefault();
          lastElement.focus();
        }

        return;
      }

      if (
        activeElement === lastElement ||
        !container.contains(activeElement)
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;

      /*
        Return focus to whatever opened the dialog.

        Checked against the document because the trigger may have been
        unmounted while the dialog was open -- deleting the row the
        dialog was about, for instance -- and focusing a detached node
        silently sends focus to the body.
      */
      const previous = previousActiveElementRef.current;

      if (previous && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [open, closeOnEscape, panelRef]);
}
