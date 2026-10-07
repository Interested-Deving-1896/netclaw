# Draft: Why NetClaw is deferring Agent Substrate

Agent Substrate separates an agent session from the pod that executes it. That is interesting for a large population of mostly idle sessions, and Google and kagent are investing in that direction.

We reviewed the project against NetClaw before adopting it. The decisive mismatch is network behavior: the inspected actor egress contract supports HTTP(S), while NetClaw depends on device SSH, persistent federation channels and always-on telemetry receivers. A snapshot also cannot recover a remote device transaction or replace an approval/audit record.

A future design could keep network execution on-premises and place selected investigation sessions behind an authenticated HTTP boundary. That is a substantive integration project, with tenant authorization, reconnects, durable operation ownership and a new security-posture implementation. We have not established a workload or cost benefit that justifies it today.

The decision is to defer. Branch 143 records the evidence and the conditions for reconsideration. No cluster or Substrate deployment was created, and no performance claims were validated. Ordinary containerization remains a separate path toward cloud portability; keeping execution near devices remains a strong default.

This is a local, unpublished architecture-decision draft. It is not an announcement of a shipped capability.
