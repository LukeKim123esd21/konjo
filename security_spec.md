# Security Specification for KONJO Studio

## 1. Data Invariants
- A user profile must be owned by the authenticated user associated with the `userId`.
- Users cannot change their own roles (e.g., escalating from NORMAL to VIP).
- `createdAt` is immutable.
- `updatedAt` must be set to the server time on every update.
- Users can only read their own private profiles.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing**: Creating a profile for another UID.
2. **Privilege Escalation**: Setting `role: 'VIP'` during registration.
3. **Ghost Field Injection**: Adding `isVerified: true` to the user profile.
4. **Immutability Breach**: Updating `createdAt`.
5. **ID Poisoning**: Attempting to use a 1MB string as a userId.
6. **Time Spoofing**: Providing a client-side timestamp for `updatedAt`.
7. **Cross-User Read**: Attempting to 'get' another user's profile.
8. **Shadow Update**: Updating a field not in the schema.
9. **Role Self-Assignment**: Updating `role` field as a non-admin.
10. **Orphan Write**: Creating a user profile without being logged in.
11. **PII Leak**: Querying for all user emails.
12. **Denial of Wallet**: Sending a massive string in `displayName`.

## 3. Test Runner (Conceptual placeholders for rules)
All the above payloads MUST return `PERMISSION_DENIED`.
