# Managed change authority

The private operator interface separates review from apply. An assistant may
prepare a proposal but cannot apply it. The originating grant snapshot remains
attached to that proposal: revocation, expiry, generation or permission changes
deny later dispatch even when a human opens its review. Prepare again after
reviewing the new authority. Already retained outcomes remain historical evidence.

Selected installations configured with `N2N_RISK_MODE=production` require live
ServiceNow approval for managed settings, environment, budget and service changes.
Legacy broad lab flags do not waive this requirement. Terminal Intent's explicitly
designated Local/Lab workflow is separate; its management adapter is still being
implemented and no generic local approval is accepted for it.

## ServiceNow prerequisites

This adapter performs only fixed GETs using the
[ServiceNow Table API](https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html).
It creates, approves and closes no tickets. Configure a dedicated OAuth token
with read access to the required change, approval, affected-CI and incident fields
and complete P1/P2 visibility for the managed CIs. A read filtered by restrictive
ACLs cannot establish absence of incidents. Qualify that visibility using known
positive and negative records before production use.

The integration requires an administrator-approved exact-action digest mapping.
These are **deployment-specific custom fields**, not fields assumed to exist in
standard ServiceNow. A protected digest field on the change and an independently
protected digest field on each approval must both contain the exact proposal
`actionDigest`. The approval workflow must copy the reviewed digest when an
independent person approves it, and invalidate approval when the reviewed action
changes. The executing account must not be able to set an approval digest or
approve its own action. Configure and test those server-side ACL/workflow rules;
NetClaw does not create or weaken them.

Under the selected runtime's private `netclaw-hud/`, create an owned mode-0600
`change-authority.json` after verifying the actual instance fields and state:

```json
{
  "schemaVersion": 1,
  "installationId": "EXISTING-INSTALLATION-UUID",
  "origin": "https://YOUR-INSTANCE.service-now.com",
  "executorPrincipalId": "os:YOUR-ACTUAL-UID",
  "executorUserSysId": "EXECUTING-SERVICENOW-USER-SYS-ID",
  "credential": {"tokenRef": "NETCLAW_CHANGE_AUTH_TOKEN"},
  "implementState": "YOUR-VERIFIED-IMPLEMENT-STATE-NUMBER",
  "changeDigestField": "u_netclaw_action_digest",
  "approvalDigestField": "u_netclaw_action_digest",
  "targetCis": {"EXISTING-INSTALLATION-UUID": ["ACTUAL-CI-SYS-ID"]}
}
```

This is a template with placeholders. State values and field names must be
verified against the customer's instance. Store the token only in that runtime's
private `.env`. The JSON stores its variable name, never its value. Do not paste
tokens into chat, VS Code settings or approval references. Changing the binding
or environment invalidates any previous proposal revision.

## Verification behavior

Human Apply accepts only an exact `CHG` number. The adapter validates the change's
current Implement state, overall approval, active flag and exact digest. Every
returned approval must be approved for that digest by a user different from the
configured executor. The supported deployment profile requires all approval rows
to be approved; workflows containing cancelled/not-required rows need separate
qualification. The change's primary or affected CI list must cover every mapped
target. Any open P1/P2 incident on those CIs blocks the action.

Reads are bounded, have a total deadline, use HTTPS without redirects and expose
neither remote response bodies nor credentials in errors. Missing fields,
ambiguous records, changed bindings, truncation and API failures deny execution.
Live authority is re-read before dispatch, at adapter checkpoints and after
verification. Withdrawal after dispatch triggers the captured recovery path and
retains a failed outcome. No failure is reported as a closed successful CR.

The read-only verifier has synthetic API contract and withdrawal tests on Mac.
**No real ServiceNow instance, custom approval workflow or account visibility has
been qualified in this session.** Production integration acceptance remains open.
The extension's same-UID trust limit still applies; this is not OS confinement.
