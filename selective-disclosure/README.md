# Selective Disclosure Plugin Example

This directory contains the separate Veramo Selective Disclosure plugin demo.

It uses:

- `@veramo/selective-disclosure`
- `new SelectiveDisclosure()`
- `new DataStoreORM(dbConnection)`

The root `../example.ts` stays as the lecture-aligned VC/VP example.

## Run

From `UniversityExampleSSI`:

```bash
export SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
export KMS_SECRET_KEY="$(npx @veramo/cli config create-secret-key)"
npm run start:selective-disclosure
```

## Flow

1. University of Pisa issues Alice a `UniversityDegreeCredential`.
2. Alice stores the VC locally.
3. Job Recruiter creates a Selective Disclosure Request JWT with `createSelectiveDisclosureRequest`.
4. Alice finds matching credentials with `getVerifiableCredentialsForSdr`.
5. Alice creates a VP response.
6. Job Recruiter validates the VP with `validatePresentationAgainstSdr`.

Expected summary:

```ts
{
  requestJwtCreated: true,
  requestedClaims: ['degreeClass', 'degreeName', 'graduationDate'],
  matchingCredentialCounts: [1, 1, 1],
  responseCredentialCount: 1,
  presentationMatchesRequest: true,
}
```

Note: this Veramo plugin implements the older uPort Selective Disclosure Request flow. It is useful for teaching SDR concepts, but production systems should evaluate newer formats such as SD-JWT VC, BBS+, or AnonCreds.
