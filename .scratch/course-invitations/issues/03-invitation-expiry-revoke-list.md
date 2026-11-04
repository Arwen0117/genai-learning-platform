# 03: Invitation expiry, revoke, and owner list

**What to build:** On the Course roster area, the owner can list Invitations with active / expired / revoked state, optionally set an expiry when creating, and revoke a token so redeem stops immediately. A Course may have several Invitations at once so links can be rotated. No redemption use cap.

**Blocked by:** 02: Create Invitation & signed-in Learner redeem

**Status:** done

- [x] Course owner can list Invitations for their Course with distinguishable active, expired, and revoked states
- [x] Owner can create an Invitation with an optional expiry; after expiry, redeem fails clearly
- [x] Owner can revoke an Invitation; redeem fails clearly afterward
- [x] Multiple Invitations can be active on the same Course at once
- [x] Non-owner cannot list or revoke (same ownership gate as create / roster import)
- [x] Invitation module tests cover expiry and revoke reject paths (and list/status as exposed by the module)
- [x] User-visible strings go through the existing i18n layer
