export function wireEvents({
  renderHistory,
  showScreen,
  getActiveHomeSession,
  getCompletedDays,
  getWeekKey,
  startSession,
  advanceOnboardingStep,
  renderSlotMachine,
  discardSessionAndGoHome,
  startSpinReveal,
  swapWorkoutExercise,
  launchExercise,
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
  document
    .getElementById("day-picker-cards")
    .addEventListener("click", async (e) => {
      const card = e.target.closest("[data-day]");
      if (!card) return;
      const activeSession = getActiveHomeSession();
      if (card.classList.contains("completed")) return;
      if (getCompletedDays(getWeekKey()).includes(card.dataset.day)) return;

      if (activeSession) {
        if (activeSession.templateId !== card.dataset.day) return;
        resumeSession();
        return;
      }

      startSession(card.dataset.day);
      advanceOnboardingStep("home_card", "start_button");
      renderSlotMachine();
      showScreen("screen-slot-machine");
    });

  document
    .getElementById("slot-machine-back")
    .addEventListener("click", async () => {
      discardSessionAndGoHome();
    });

  document
    .getElementById("slot-spin-button")
    .addEventListener("click", startSpinReveal);

  document.getElementById("reels-container").addEventListener("click", (e) => {
    const swapBtn = e.target.closest("[data-workout-swap]");
    if (!swapBtn) return;
    const slotIndex = Number.parseInt(swapBtn.dataset.workoutSwap, 10);
    if (Number.isNaN(slotIndex)) return;
    void swapWorkoutExercise(slotIndex);
  });

  document
    .getElementById("slot-trigger-status")
    .addEventListener("click", () => {
      advanceOnboardingStep("pull_handle", "start_button");
      launchExercise();
    });

  document
    .getElementById("exercise-back")
    .addEventListener("click", async (e) => {
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
      showScreen("screen-day-picker");
    });

  document
    .getElementById("history-more-btn")
    .addEventListener("click", async () => {
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
