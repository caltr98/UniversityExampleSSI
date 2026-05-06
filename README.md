# University Degree VC Demo With Veramo

This is the code version of the slide example **"Alice's University Degree Proof"**.

It follows the same actors and the same steps from the slides.

## Actors From The Slides

| Actor | SSI role | In the code |
| --- | --- | --- |
| University of Pisa | Issuer | `university` |
| Alice | Holder / Subject | `alice` |
| Job Recruiter | Verifier | `jobRecruiter` |

## The Flow From The Slides

The program follows the slide sequence:

| Step | Slide meaning | What the code does |
| --- | --- | --- |
| A | DIDs creation | Create or retrieve DIDs for University of Pisa, Alice, and Job Recruiter. |
| B | Payload | Build the degree claims about Alice. |
| C | Issue VC | University signs the degree credential as JWT. |
| D | Store VC | Alice stores the degree VC in Veramo's local data store. |
| E | Create VP | Alice creates a VP embedding the degree VC. |
| F | Verify | Job Recruiter verifies the VP and the embedded VC. |

The main idea is:

```text
University of Pisa signs a VC -> Alice embeds it in a VP -> Job Recruiter verifies it
```

## Required Environment

You need an Alchemy Sepolia RPC URL.

Create an Alchemy Sepolia app and export the URL like in the slides:

```bash
export SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
```

You can also set the key only:

```bash
export ALCHEMY_API_KEY="YOUR_KEY"
```

The code will convert that key into:

```text
https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

Generate the local key encryption secret with the Veramo command shown in the slides:

```bash
export KMS_SECRET_KEY="$(npx @veramo/cli config create-secret-key)"
```

This secret encrypts private keys inside the local SQLite database. Keep it private.

## Run

From this folder:

```bash
npm install
export SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
export KMS_SECRET_KEY="$(npx @veramo/cli config create-secret-key)"
npm run start
```

From the repository root:

```bash
export SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
export KMS_SECRET_KEY="$(npx @veramo/cli config create-secret-key)"
TS_NODE_PROJECT=UniversityExampleSSI/tsconfig.json node --loader ts-node/esm UniversityExampleSSI/example.ts
```

## What To Read First

Read `example.ts` first.

It is intentionally written like the slides:

```ts
console.log('\nA. DIDs creation')
```

```ts
console.log('\nB. Payload: claims about Alice Degree')
```

```ts
console.log('\nC. Issue VC: sign as JWT')
```

```ts
console.log('\nD. Store VC: Alice stores Degree VC')
```

```ts
console.log('\nE. Create VP: Alice generates VP embedding the Degree VC')
```

```ts
console.log('\nF. Verify: recruiter checks VP')
```

## A. DIDs Creation

The slides use this idea:

```ts
const university = await getOrCreateDid(agent, 'university-of-pisa')
const alice = await getOrCreateDid(agent, 'alice')
```

The code does the same and also creates the verifier:

```ts
const jobRecruiter = await getOrCreateDid(agent, 'job-recruiter')
```

Each actor gets a Sepolia Ethereum DID:

```text
did:ethr:sepolia:0x...
```

## B. Payload

The credential payload uses the same fields from the slide:

```ts
credentialSubject: {
  id: alice.did,
  fullName: 'Alice Rossi',
  birthDate: '2002-10-28',
  birthPlace: 'Lucca (LU), Italy',
  enrollmentDate: '2024-07-28',
  academicYear: '2024/2025',
  degreeName: 'Laurea Magistrale in Informatica',
  curriculum: 'ICT - ICT Solutions Architect',
  degreeClass: 'LM-18',
  normalDuration: '2 years',
  graduationDate: '2026-10-11',
  finalGrade: '110/110 e lode',
  diplomaIssueDate: '2026-10-11',
}
```

This means the university is making claims about Alice's degree.

## C. Issue VC

The university signs the credential:

```ts
const degreeVC = await agent.createVerifiableCredential({
  credential: degreeCredentialPayload,
  proofFormat: 'jwt',
})
```

`proofFormat: 'jwt'` means the credential is signed as a JWT credential.

## D. Store VC

Alice stores the degree credential locally:

```ts
const storedVcHash = await agent.dataStoreSaveVerifiableCredential({
  verifiableCredential: degreeVC,
})
```

This uses Veramo's local SQLite database.

## E. Create VP

Alice creates a VP and embeds the degree VC:

```ts
const degreePresentationPayload = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: ['VerifiablePresentation'],
  holder: alice.did,
  verifiableCredential: [degreeVC],
}
```

The important line is:

```ts
verifiableCredential: [degreeVC]
```

That line means the VP contains the VC.

Then Alice signs the VP:

```ts
const degreeVP = await agent.createVerifiablePresentation({
  presentation: degreePresentationPayload,
  proofFormat: 'jwt',
})
```

## F. Verify

The recruiter verifies the VP:

```ts
const vpVerificationResult = await agent.verifyPresentation({
  presentation: degreeVP,
})
```

The code also verifies every VC embedded inside the VP:

```ts
const embeddedCredentials = extractEmbeddedCredentials(degreeVP)
for (const embeddedCredential of embeddedCredentials) {
  await agent.verifyCredential({ credential: embeddedCredential })
}
```

This is important because the VP and VC prove different things.

The VC proves:

```text
University of Pisa signed Alice's degree credential.
```

The VP proves:

```text
Alice is presenting that credential.
```

## Expected Output

You should see output similar to this:

```text
University Degree VC demo with Veramo
Step by Step program

A. DIDs creation
B. Payload: claims about Alice Degree
C. Issue VC: sign as JWT
D. Store VC: Alice stores Degree VC
E. Create VP: Alice generates VP embedding the Degree VC
F. Verify: recruiter checks VP
Verified: true
Embedded VC 1 verified: true
```

The DID values will be different on each machine.

## Does This Send Transactions?

No.

This example uses Sepolia RPC for DID resolution, but it does not send an Ethereum transaction and does not need Sepolia ETH.

## Local Files Created

Veramo stores local keys, DIDs, and credentials in SQLite.

By default this example uses:

```text
database.sqlite
```

If you want a clean run:

```bash
rm -f database.sqlite
```

## Common Error

If you see:

```text
Missing Sepolia RPC configuration
```

Set:

```bash
export SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
```

Then run again:

```bash
npm run start
```
