import { createHash } from 'crypto'
import {
  CredentialPayload,
  IIdentifier,
  PresentationPayload,
  W3CVerifiableCredential,
  W3CVerifiablePresentation,
} from '@veramo/core-types'
import { agent, SEPOLIA_DID_PROVIDER } from './src/setup.js'

type DegreeClaims = {
  id: string
  fullName: string
  birthDate: string
  birthPlace: string
  enrollmentDate: string
  academicYear: string
  degreeName: string
  curriculum: string
  degreeClass: string
  normalDuration: string
  graduationDate: string
  finalGrade: string
  diplomaIssueDate: string
}

type RecruiterRequirement = {
  role: string
  acceptedDegreeClass: string
  acceptedDegreeKeyword: string
  graduationDateMustBeOnOrBefore: string
  claimsRequested: Array<keyof DegreeClaims>
  claimsNotRequested: Array<keyof DegreeClaims>
  privatePredicateRequested: string
}

type SelectiveDisclosureApplication = {
  holder: string
  verifier: string
  role: string
  revealedClaims: Pick<DegreeClaims, 'id' | 'fullName' | 'degreeName' | 'degreeClass' | 'graduationDate'>
  hiddenClaims: Array<keyof DegreeClaims>
  hiddenClaimsCommitment: string
  sourceCredentialHash: string
}

type SelectiveDisclosureCheck = {
  onlyRequestedClaimsRevealed: boolean
  degreeClassAccepted: boolean
  degreeNameAccepted: boolean
  graduationDateAccepted: boolean
  verifierCanDecide: boolean
}

type EducationalZkPredicateProof = {
  holder: string
  verifier: string
  publicStatement: string
  publicResult: boolean
  hiddenInputs: Array<keyof DegreeClaims>
  hiddenInputCommitment: string
  concretePrivateWitnessUsedByDemo: Pick<DegreeClaims, 'finalGrade'>
  verifierLearns: string
  warning: string
}

type EducationalZkPredicateCheck = {
  predicateAccepted: boolean
  finalGradeWasNotRevealedInSelectiveDisclosure: boolean
  verifierAccepts: boolean
}

type JwtVpPayload = {
  vp?: {
    verifiableCredential?: W3CVerifiableCredential[]
  }
}

async function getOrCreateDid(veramo: typeof agent, alias: string): Promise<IIdentifier> {
  try {
    return await veramo.didManagerGetByAlias({
      alias,
      provider: SEPOLIA_DID_PROVIDER,
    })
  } catch {
    return await veramo.didManagerCreate({
      alias,
      provider: SEPOLIA_DID_PROVIDER,
      kms: 'local',
    })
  }
}

function extractEmbeddedCredentials(vp: W3CVerifiablePresentation): W3CVerifiableCredential[] {
  if (typeof vp === 'string') {
    const [, payload] = vp.split('.')
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtVpPayload
    return decodedPayload.vp?.verifiableCredential ?? []
  }

  return vp.verifiableCredential ?? []
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function main(): Promise<void> {
  console.log('\nUniversity Degree VC demo with Veramo')
  console.log('Step by Step program')

  console.log('\nA. DIDs creation')
  const university = await getOrCreateDid(agent, 'university-of-pisa')
  const alice = await getOrCreateDid(agent, 'alice')
  const jobRecruiter = await getOrCreateDid(agent, 'job-recruiter')

  console.table([
    { actor: 'University of Pisa', role: 'Issuer', did: university.did },
    { actor: 'Alice', role: 'Holder / Subject', did: alice.did },
    { actor: 'Job Recruiter', role: 'Verifier', did: jobRecruiter.did },
  ])

  console.log('\nB. Payload: claims about Alice Degree')
  const degreeClaims: DegreeClaims = {
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

  const degreeCredentialPayload: CredentialPayload = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: { id: university.did },
    issuanceDate: new Date().toISOString(),
    credentialSubject: degreeClaims,
  }
  console.log(degreeCredentialPayload)

  console.log('\nC. Issue VC: sign as JWT')
  const degreeVC: W3CVerifiableCredential = await agent.createVerifiableCredential({
    credential: degreeCredentialPayload,
    proofFormat: 'jwt',
  })
  console.log('\n--- Degree VC with JWT ---')
  console.log(degreeVC)

  console.log('\nD. Store VC: Alice stores Degree VC')
  const storedVcHash = await agent.dataStoreSaveVerifiableCredential({
    verifiableCredential: degreeVC,
  })
  console.log('\n--- Stored VC ---')
  console.log('Stored VC hash:', storedVcHash)

  console.log('\nE. Create VP: Alice generates VP embedding the Degree VC')
  const degreePresentationPayload: PresentationPayload = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    holder: alice.did,
    verifiableCredential: [degreeVC],
  }

  const degreeVP: W3CVerifiablePresentation = await agent.createVerifiablePresentation({
    presentation: degreePresentationPayload,
    proofFormat: 'jwt',
  })
  console.log('\n--- Degree VP with embedded VC ---')
  console.log(degreeVP)

  console.log('\nF. Verify VP: recruiter checks the presentation')
  const vpVerificationResult = await agent.verifyPresentation({
    presentation: degreeVP,
  })
  console.log('\n--- VP Verification result ---')
  console.log('Verified:', vpVerificationResult.verified)

  console.log('\nF. Verify VC: recruiter checks every VC embedded in the VP')
  const embeddedCredentials = extractEmbeddedCredentials(degreeVP)
  for (const [index, embeddedCredential] of embeddedCredentials.entries()) {
    const vcVerificationResult = await agent.verifyCredential({
      credential: embeddedCredential,
    })
    console.log(`Embedded VC ${index + 1} verified:`, vcVerificationResult.verified)
  }

  console.log('\nG. Privacy preserving continuation: selective disclosure and ZKP-style proof')
  console.log('This JWT example is didactic: real selective disclosure/ZKP needs formats such as SD-JWT VC, BBS+, or AnonCreds.')

  const recruiterRequirement: RecruiterRequirement = {
    role: 'Junior Blockchain / SSI Engineer',
    acceptedDegreeClass: 'LM-18',
    acceptedDegreeKeyword: 'Informatica',
    graduationDateMustBeOnOrBefore: '2026-12-31',
    claimsRequested: ['id', 'fullName', 'degreeName', 'degreeClass', 'graduationDate'],
    claimsNotRequested: [
      'birthDate',
      'birthPlace',
      'enrollmentDate',
      'academicYear',
      'curriculum',
      'normalDuration',
      'finalGrade',
      'diplomaIssueDate',
    ],
    privatePredicateRequested: 'Prove finalGrade is at least 100/110 without revealing finalGrade.',
  }

  console.log('\n--- Concrete recruiter requirement ---')
  console.log(recruiterRequirement)

  const hiddenClaims: Array<keyof DegreeClaims> = [
    'birthDate',
    'birthPlace',
    'enrollmentDate',
    'academicYear',
    'curriculum',
    'normalDuration',
    'finalGrade',
    'diplomaIssueDate',
  ]

  const selectiveDisclosureApplication: SelectiveDisclosureApplication = {
    holder: alice.did,
    verifier: jobRecruiter.did,
    role: recruiterRequirement.role,
    revealedClaims: {
      id: degreeClaims.id,
      fullName: degreeClaims.fullName,
      degreeName: degreeClaims.degreeName,
      degreeClass: degreeClaims.degreeClass,
      graduationDate: degreeClaims.graduationDate,
    },
    hiddenClaims,
    hiddenClaimsCommitment: sha256(
      Object.fromEntries(hiddenClaims.map((claim) => [claim, degreeClaims[claim]])),
    ),
    sourceCredentialHash: sha256(degreeVC),
  }

  console.log('\n--- Selective disclosure job application sent to recruiter ---')
  console.log(selectiveDisclosureApplication)

  const selectiveDisclosureCheck: SelectiveDisclosureCheck = {
    onlyRequestedClaimsRevealed: Object.keys(selectiveDisclosureApplication.revealedClaims).every((claim) =>
      recruiterRequirement.claimsRequested.includes(claim as keyof DegreeClaims),
    ),
    degreeClassAccepted:
      selectiveDisclosureApplication.revealedClaims.degreeClass === recruiterRequirement.acceptedDegreeClass,
    degreeNameAccepted: selectiveDisclosureApplication.revealedClaims.degreeName.includes(
      recruiterRequirement.acceptedDegreeKeyword,
    ),
    graduationDateAccepted:
      selectiveDisclosureApplication.revealedClaims.graduationDate <= recruiterRequirement.graduationDateMustBeOnOrBefore,
    verifierCanDecide: false,
  }
  selectiveDisclosureCheck.verifierCanDecide =
    selectiveDisclosureCheck.onlyRequestedClaimsRevealed &&
    selectiveDisclosureCheck.degreeClassAccepted &&
    selectiveDisclosureCheck.degreeNameAccepted &&
    selectiveDisclosureCheck.graduationDateAccepted

  console.log('\n--- Recruiter checks selective disclosure packet ---')
  console.log(selectiveDisclosureCheck)

  const finalGradeNumber = Number.parseInt(degreeClaims.finalGrade, 10)
  const gradeThreshold = 100
  const gradePredicateAccepted = finalGradeNumber >= gradeThreshold

  const gradePredicateProof: EducationalZkPredicateProof = {
    holder: alice.did,
    verifier: jobRecruiter.did,
    publicStatement: `Alice's final grade is at least ${gradeThreshold}/110.`,
    publicResult: gradePredicateAccepted,
    hiddenInputs: ['finalGrade'],
    hiddenInputCommitment: sha256({ finalGrade: degreeClaims.finalGrade, nonce: 'lecture-demo-nonce' }),
    concretePrivateWitnessUsedByDemo: { finalGrade: degreeClaims.finalGrade },
    verifierLearns: `Only the boolean result: ${gradePredicateAccepted}. The exact finalGrade is not in the selective disclosure packet.`,
    warning: 'Teaching mock only: this hash is a commitment, not a real zero-knowledge proof.',
  }

  const gradePredicateCheck: EducationalZkPredicateCheck = {
    predicateAccepted: gradePredicateProof.publicResult,
    finalGradeWasNotRevealedInSelectiveDisclosure: !Object.hasOwn(selectiveDisclosureApplication.revealedClaims, 'finalGrade'),
    verifierAccepts: false,
  }
  gradePredicateCheck.verifierAccepts =
    gradePredicateCheck.predicateAccepted && gradePredicateCheck.finalGradeWasNotRevealedInSelectiveDisclosure

  console.log('\n--- Zero-knowledge predicate proof example ---')
  console.log(gradePredicateProof)

  console.log('\n--- Recruiter checks ZKP-style predicate result ---')
  console.log(gradePredicateCheck)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
