# Mobile and edge in VS Code

Open **NetClaw: Inspect Mobile and Edge / Request Capture**, or **Mobile capture
and consent** in the estate explorer. Enrollment, current authenticated channel
connectivity, heartbeat age and device-advertised capture capabilities are
separate observations. An offline phone remains enrolled.

For a connected enrolled phone, choose an advertised `camera.capture` or
`audio.record` capability and review the exact device and installation. The
backend creates a five-minute review bound to the pinned enrollment and current
capability set. **Request phone consent** admits that request; it cannot supply
the phone's native permission. Declined and cancelled decisions remain explicit.
Hermes capture, video capture, notifications, enrollment changes and quarantine
are not dispatched by this control.

The existing federation daemon carries the capture over the enrolled device's
authenticated edge channel. Immediately before sending, it independently checks
the private operator admission, current worker lease, exact device, enrollment,
capability and review expiry. It never routes the request to another phone.
Closing VS Code or the MCP connection does not resend or cancel owned work.
Reopen the view to inspect progress or request cancellation. Cancellation after
dispatch may leave an unknown outcome; it does not mean a camera request was
undone. Uncertain work is never automatically repeated.

Captured media is retained in the existing private federation result store.
The response to VS Code contains only its type, size and SHA-256. Choose a
completed capture in **Retained capture operations** and explicitly save a local
copy to retrieve it. Bounded chunks and the final hash are verified before the
selected destination is written. Captures are limited to 6 MiB. Nothing is
automatically added to Chat, Canvas, RAG, a model request or a notification.

The backend management components and updated federation route must be present
through the normal NetClaw update process. The extension does not restart or
upgrade a running federation service. A missing route remains unavailable.

Mac qualification uses an authenticated simulated phone. It does not verify
physical camera/microphone prompts or Windows/WSL; those remain device/platform
acceptance gates. See [Spec150 workspace evidence](../specs/150-vscode-extension/evidence/workspace.md).
