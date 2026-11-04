# 04: Register via Invitation (choose password)

**What to build:** A logged-out visitor opens a valid Invitation link, registers as a Learner with a password they choose, receives an Enrollment, and can open the Course. CSV roster import still uses temporary passwords and the one-time credentials download; this path does not.

**Blocked by:** 02: Create Invitation & signed-in Learner redeem

**Status:** done

- [x] Logged-out visitor with a valid Invitation can register (Learner) with a self-chosen password
- [x] Successful registration Enrolls them in the Invitation’s Course
- [x] After accept, they can open / continue into the Course without a separate manual enroll step
- [x] Expired, revoked, invalid, or non-PUBLISHED Invitation links still fail clearly on this path
- [x] Instructor role cannot use this path to create an Enrollment (same redeem rule as signed-in)
- [x] CSV import temporary-password behaviour is unchanged
- [x] Auth remains credentials-based (no SSO / magic-link login redesign)
- [x] Invitation module / accept flow tests cover new-User redeem with chosen password
- [x] User-visible strings go through the existing i18n layer
