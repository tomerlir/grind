export function wireEvents({
  audioEngine,
  renderHistory,
  showScreen,
  getActiveHomeSession,
  getCompletedDays,
  getWeekKey,
  startSession,
  advanceOnboardingStep,
  renderSlotMachine,
  discardSessionAndGoHome,
  launchExercise,
  handlePullTriggerStart,
  handlePullTriggerMove,
  finishPullTrigger,
  handlePullTriggerKeydown,
  openExitSessionModal,
  dismissKeyboard,
  handleExercisePrimaryAction,
  updateCurrentSetField,
  goHome,
  showMoreHistory,
  deleteHistoryEntry,
  closeExitSessionModal,
  applyAppUpdate,
  closeUpdateAppModal,
  finishOnboarding,
  queueOnboardingRefresh,
  trackOnboardingViewport,
  resumeSession,
}) {
  document.getElementById("resume-btn").addEventListener("click", resumeSession);

  document
    .getElementById("day-picker-cards")
    .addEventListener("click", async (e) => {
      const card = e.target.closest("[data-day]");
      if (!card) return;
      if (getActiveHomeSession()) return;
      if (card.classList.contains("completed")) return;
      if (getCompletedDays(getWeekKey()).includes(card.dataset.day)) return;

      void audioEngine.play("card-tap");
      startSession(card.dataset.day);
      advanceOnboardingStep("home_card", "pull_handle");
      renderSlotMachine();
      showScreen("screen-slot-machine");
    });

  document
    .getElementById("slot-machine-back")
    .addEventListener("click", async () => {
      void audioEngine.play("navigate-back");
      discardSessionAndGoHome();
    });

  document
    .getElementById("slot-trigger-status")
    .addEventListener("click", launchExercise);

  const pullTrigger = document.getElementById("slot-pull-trigger");
  pullTrigger.addEventListener("pointerdown", handlePullTriggerStart);
  pullTrigger.addEventListener("pointermove", handlePullTriggerMove);
  pullTrigger.addEventListener("pointerup", (e) => finishPullTrigger(e));
  pullTrigger.addEventListener("pointercancel", (e) =>
    finishPullTrigger(e, { cancel: true }),
  );
  pullTrigger.addEventListener("lostpointercapture", (e) =>
    finishPullTrigger(e, { cancel: true }),
  );
  pullTrigger.addEventListener("keydown", handlePullTriggerKeydown);

  document
    .getElementById("exercise-back")
    .addEventListener("click", async (e) => {
      try {
        void audioEngine.play("navigate-back");
      } catch (error) {
        console.error("Failed to play navigate-back sound:", error);
      }

      openExitSessionModal(e.currentTarget);
    });

  document
    .getElementById("sets-container")
    .addEventListener("click", async (e) => {
      const action = e.target.closest('[data-exercise-action="primary"]');
      if (!action) return;
      dismissKeyboard();
      setTimeout(() => {
        void handleExercisePrimaryAction();
      }, 50);
    });

  document.getElementById("sets-container").addEventListener("input", (e) => {
    const input = e.target.closest("[data-field]");
    if (!input) return;
    updateCurrentSetField(
      parseInt(input.dataset.idx, 10),
      input.dataset.field,
      input.value,
    );
  });

  document.getElementById("sets-container").addEventListener("keydown", (e) => {
    const input = e.target.closest("[data-field]");
    if (!input || e.key !== "Enter") return;

    e.preventDefault();
    if (input.dataset.field === "weight") {
      const repsInput = document.getElementById(`reps-${input.dataset.idx}`);
      if (repsInput) repsInput.focus();
      return;
    }

    if (input.dataset.field === "reps") {
      input.blur();
    }
  });

  document.getElementById("done-back-btn").addEventListener("click", goHome);

  document
    .getElementById("history-back")
    .addEventListener("click", async () => {
      void audioEngine.play("navigate-back");
      showScreen("screen-day-picker");
    });

  document
    .getElementById("history-more-btn")
    .addEventListener("click", async () => {
      try {
        void audioEngine.play("card-tap");
      } catch (error) {
        console.error("Failed to play card-tap sound:", error);
      }
      showMoreHistory();
    });

  document.getElementById("history-list").addEventListener("click", (e) => {
    const deleteBtn = e.target.closest("[data-history-delete]");
    if (deleteBtn) {
      deleteHistoryEntry(Number(deleteBtn.dataset.historyDelete));
      return;
    }

    const toggle = e.target.closest(".history-expand-hint");
    if (!toggle) return;
    const card = toggle.closest(".history-card");
    if (card) card.classList.toggle("expanded");
  });

  document
    .getElementById("exit-session-cancel")
    .addEventListener("click", closeExitSessionModal);
  document
    .getElementById("exit-session-resume-later")
    .addEventListener("click", goHome);
  document
    .getElementById("exit-session-discard")
    .addEventListener("click", discardSessionAndGoHome);
  document
    .getElementById("exit-session-modal")
    .addEventListener("click", (e) => {
      if (e.target.id === "exit-session-modal") closeExitSessionModal();
    });
  document
    .getElementById("update-app-confirm")
    .addEventListener("click", applyAppUpdate);
  document
    .getElementById("update-app-later")
    .addEventListener("click", closeUpdateAppModal);
  document.getElementById("update-app-modal").addEventListener("click", (e) => {
    if (e.target.id === "update-app-modal") closeUpdateAppModal();
  });
  document
    .getElementById("coachmark-skip")
    .addEventListener("click", () => finishOnboarding("dismissed"));
  window.addEventListener("resize", queueOnboardingRefresh);
  document.addEventListener("scroll", queueOnboardingRefresh, true);
  document.addEventListener("focusin", (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      trackOnboardingViewport();
    }
  });
  document.addEventListener("focusout", (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      trackOnboardingViewport();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const modal = document.getElementById("exit-session-modal");
    if (modal?.classList.contains("show")) closeExitSessionModal();
    const updateModal = document.getElementById("update-app-modal");
    if (updateModal?.classList.contains("show")) closeUpdateAppModal();
  });
}
