"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "../../lib/runtime-config";

type OnboardingFlowProps = { username: string };

const stepLabels = ["Welcome to Pb", "Meet Ghost", "Ready to start"] as const;

const recommendations = [
  {
    number: "01",
    title: "Complete your profile",
    copy: "Add a photo and make Pb yours.",
  },
  {
    number: "02",
    title: "Find your people",
    copy: "Search for people you know and connect.",
  },
  {
    number: "03",
    title: "Start a conversation",
    copy: "Send your first message.",
  },
] as const;

export function OnboardingFlow({ username }: OnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (step === 0) return;
    window.scrollTo({ top: 0 });
    stepHeadingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const complete = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/onboarding/complete`,
        { method: "POST", credentials: "include" },
      );
      const value: unknown = await response.json();
      if (!response.ok) {
        const message =
          value &&
          typeof value === "object" &&
          "error" in value &&
          typeof value.error === "string"
            ? value.error
            : "We could not finish setup. Please try again.";
        setError(message);
        return;
      }
      router.replace("/chat");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="onboarding-card" aria-live="polite">
      <div
        className="onboarding-progress"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step + 1}
        aria-valuetext={`Step ${step + 1} of 3: ${stepLabels[step]}`}
      >
        {stepLabels.map((label, index) => (
          <span
            key={label}
            className={index <= step ? "is-active" : undefined}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="onboarding-step" key={step}>
        {step === 0 ? (
          <div className="onboarding-welcome">
            <div className="onboarding-welcome-mark" aria-hidden="true">
              <span>Pb</span>
              <i />
            </div>
            <p className="public-eyebrow">Welcome to Pb</p>
            <h1 ref={stepHeadingRef} tabIndex={-1}>
              Hi {username}, welcome in.
            </h1>
            <p className="onboarding-tagline">Your message. Your control.</p>
            <p className="onboarding-copy">
              A quieter place to talk, share, and stay connected.
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="onboarding-ghost-step">
            <div className="onboarding-step-heading">
              <p className="public-eyebrow">A Pb original</p>
              <h1 ref={stepHeadingRef} tabIndex={-1}>
                Meet Ghost
              </h1>
              <p className="onboarding-copy">
                Ghost can hold your message before it is released, so you decide
                when it is ready to be seen.
              </p>
            </div>
            <div className="ghost-demo" aria-label="How Ghost messages work">
              <div className="ghost-demo-message">
                <span>You write</span>
                <strong>“I need to tell you something…”</strong>
              </div>
              <span className="ghost-demo-arrow" aria-hidden="true">
                ↓
              </span>
              <div className="ghost-demo-held">
                <Image
                  src="/ghost/pb-ghost-holding-message.png"
                  width={1356}
                  height={1159}
                  sizes="(max-width: 600px) 180px, 230px"
                  alt="Pb Ghost holding a message bubble"
                  className="ghost-demo-mascot"
                  priority
                />
                <div className="ghost-demo-status">
                  <strong>Ghost is holding it</strong>
                  <span>Only release it when you choose.</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="onboarding-ready">
            <div className="onboarding-step-heading">
              <p className="public-eyebrow">Ready to start</p>
              <h1 ref={stepHeadingRef} tabIndex={-1}>
                Your Pb space is ready.
              </h1>
              <p className="onboarding-copy">
                Three simple ways to make your first visit feel like home.
              </p>
            </div>
            <div className="onboarding-recommendations">
              {recommendations.map((item) => (
                <article key={item.title}>
                  <span aria-hidden="true">{item.number}</span>
                  <div>
                    <h2>{item.title}</h2>
                    <p>{item.copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="form-message form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="onboarding-actions">
        {step > 0 ? (
          <button
            className="button button-secondary"
            type="button"
            disabled={pending}
            onClick={() => setStep((value) => value - 1)}
          >
            Back
          </button>
        ) : (
          <button
            className="button button-secondary"
            type="button"
            disabled={pending}
            onClick={() => void complete()}
          >
            Skip
          </button>
        )}
        {step < stepLabels.length - 1 ? (
          <button
            className="button button-primary"
            type="button"
            onClick={() => setStep((value) => value + 1)}
          >
            {step === 0 ? "Get started" : "Continue"}
          </button>
        ) : (
          <button
            className="button button-primary"
            type="button"
            disabled={pending}
            onClick={() => void complete()}
          >
            {pending ? "Opening Pb…" : "Enter Pb"}
          </button>
        )}
      </div>
    </section>
  );
}
