# GenAI Learning Platform

This context defines the people who use the platform, how they belong to Courses, and the learner-facing activities used to practice course concepts.

## People and membership

**User**:
A person who authenticates to the platform; the single identity for every role.
_Avoid_: Account, student (as an entity)

**Learner**:
The capability of a User who studies Courses; not a separate identity table.
_Avoid_: Student (as a type)

**Course**:
The unit of published learning content a Learner can enroll in; the only enrollment unit in v1.
_Avoid_: Class, cohort, section

**Enrollment**:
The membership of a User in one Course.
_Avoid_: Registration, roster row (as the domain concept)

**Instructor**:
The capability of a User who authors and manages Courses and views enrolled Learners' progress.
_Avoid_: Teacher, course admin (as a separate identity)

**Admin**:
The capability of a User who operates the whole platform (users, courses, platform-wide metrics).
_Avoid_: Superuser (as a product term)

**Invitation**:
A Course-scoped, shareable multi-use token link an Instructor issues so a person can join a PUBLISHED Course (creating a Learner User when needed, then an Enrollment). It may expire or be revoked; redemption count is not capped in v1. Named one-time email invites are out of scope.
_Avoid_: Invite code, magic link (unless it is this Course join path), email-bound invite

**Insights**:
The Instructor-facing Course performance dashboard, read from Enrollments and existing learning activity records (Playthrough, Lesson Progress, and related events).
_Avoid_: Analytics warehouse, separate performance app

**Report**:
A downloadable CSV snapshot of roster or Insights metrics; not a stored document.
_Avoid_: Report entity, scheduled PDF

**Lesson Progress**:
A Learner's completion state for one Lesson within a Course.
_Avoid_: Learning record (as a stored aggregate), gradebook row

## Game activities

**Game Activity**:
A short, low-stakes practice activity grounded in a lesson's objectives and composed of an ordered sequence of Challenges.
_Avoid_: Game block, assessment

**Challenge**:
One answerable moment within a Game Activity, with a prompt, learner interaction, correctness rule, and instructional feedback.
_Avoid_: Question, step

**Playthrough**:
One learner's run through a Game Activity, including submitted responses, feedback, hints, and completion state.
_Avoid_: Session, attempt

**Replay**:
A new Playthrough of a previously completed or abandoned Game Activity.
_Avoid_: Retry

**Mastery**:
A separate derived understanding of a learner's capability; it is not the completion state or correctness result of one Playthrough.
_Avoid_: Score, grade

## Challenge formats

**Sort**:
A Challenge in which the learner arranges items into one canonical order.
_Avoid_: Ordering game

**Match**:
A Challenge in which the learner connects related items from two sets.
_Avoid_: Pairing game

**Choose**:
A Challenge in which the learner selects one correct option from a set containing plausible distractors.
_Avoid_: Multiple choice

**Distractor**:
An option that is incorrect for the Challenge but represents a plausible misconception related to the lesson.
_Avoid_: Wrong answer

## Feedback and media

**Hint**:
Optional, learner-requested guidance that supports solving a Challenge without reducing correctness.
_Avoid_: Clue, penalty

**Correction**:
The correct answer and explanatory guidance shown after an incorrect response.
_Avoid_: Solution reveal

**Supporting media**:
Optional image or brief animation that enriches a Challenge or a Simulation node without carrying its only learning-critical meaning.
_Avoid_: Required media, timed mechanic

**Motion pattern**:
A named, catalogued UI motion applied to a Simulation beat (node enter, choice selected, feedback reveal, or summary enter). Authors pick from a fixed catalog; freeform CSS is not allowed.
_Avoid_: Custom animation, CSS string

**Motion beat**:
One of the four presentation moments in a Simulation run where a Motion pattern may apply: node enter, choice selected, feedback reveal, or summary enter.
_Avoid_: Step, frame, transition
