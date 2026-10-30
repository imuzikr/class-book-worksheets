"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A request belongs to one activity/student (or group). Saved-answer updates and
// later student changes must not move the teacher back to an old selection.
export function useProgressStageFocus(scopeKey) {
  const ref = useRef(null);
  const sequence = useRef(0);
  const handled = useRef(null);
  const [request, setRequest] = useState(null);

  const focusStage = useCallback((stageKey, nextScopeKey = scopeKey) => {
    if (stageKey == null || stageKey === "") {
      setRequest(null);
      return;
    }
    setRequest({
      id: ++sequence.current,
      key: String(stageKey),
      scope: nextScopeKey,
    });
  }, [scopeKey]);

  useEffect(() => {
    if (!request || request.scope !== scopeKey || handled.current === request.id) return;
    const root = ref.current;
    if (!root) return;
    const view = root.ownerDocument.defaultView;
    let target = null;
    let observer = null;
    let timeout = null;

    function moveToStage() {
      // Compare attribute values instead of constructing a CSS selector from a
      // dynamic stage key. The lookup stays inside this teacher board.
      const match = Array.from(root.querySelectorAll("[data-progress-stage]"))
        .find((node) => node.getAttribute("data-progress-stage") === request.key);
      if (!match) return false;
      target = match;
      handled.current = request.id;
      observer?.disconnect();
      if (timeout != null) view.clearTimeout(timeout);
      target.classList.add("progress-stage-target");
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      return true;
    }

    const frame = view.requestAnimationFrame(() => {
      if (moveToStage()) return;
      // Some original answers arrive after their student panel is opened.
      // Observe only until the requested section is available, never on every
      // incoming answer update once the teacher has reached it.
      observer = new view.MutationObserver(moveToStage);
      observer.observe(root, { childList: true, subtree: true });
      timeout = view.setTimeout(() => observer?.disconnect(), 2000);
    });

    return () => {
      view.cancelAnimationFrame(frame);
      observer?.disconnect();
      if (timeout != null) view.clearTimeout(timeout);
      target?.classList.remove("progress-stage-target");
    };
  }, [request, scopeKey]);

  return { ref, focusStage };
}
