# 02: Create Invitation & signed-in Learner redeem

**What to build:** The owner of a PUBLISHED Course can create a multi-use Invitation and copy its URL. A signed-in User who is not an Instructor redeems that link and gets an Enrollment in the Course (already enrolled is success). Invalid tokens, non-PUBLISHED Courses, and Instructor redeemers fail clearly. Rules live in an Invitation module behind thin server entrypoints, with tests on that module (ADR 0001).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Course owner can create an Invitation for a PUBLISHED Course and obtain a shareable redeem URL
- [x] Non-owner cannot create Invitations (same ownership gate as roster import)
- [x] Create fails for Courses that are not PUBLISHED
- [x] Signed-in non-Instructor User redeeming a valid Invitation is Enrolled in the Course
- [x] Redeem when already Enrolled succeeds as a no-op (no duplicate Enrollment error)
- [x] Users with role INSTRUCTOR cannot redeem
- [x] Redeem fails for unknown, malformed, or otherwise invalid tokens
- [x] Redeem fails when the Course is not PUBLISHED
- [x] Invitation tokens are unguessable; full tokens are not logged on normal paths
- [x] Invitation module behaviour is covered by tests at the agreed seam (create + signed-in redeem rules)
- [x] Self-enroll and CSV import still work unchanged
- [x] User-visible strings go through the existing i18n layer
