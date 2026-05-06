import {
  CredentialPayload,
  IIdentifier,
  PresentationPayload,
  W3CVerifiableCredential,
  W3CVerifiablePresentation,
} from '@veramo/core-types'
import { ISelectiveDisclosureRequest } from '@veramo/selective-disclosure'
import { agent, SEPOLIA_DID_PROVIDER } from './setup.js'

type DegreeClaims = {
  id: string
  fullName: string
  degreeName: string
  degreeClass: string
  graduationDate: string
  finalGrade: string
}

type SelectiveDisclosurePluginSummary = {
  requestJwtCreated: boolean
  requestedClaims: string[]
  matchingCredentialCounts: number[]
  responseCredentialCount: number
  presentationMatchesRequest: boolean
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

async function main(): Promise<void> {
  console.log('\nVeramo Selective Disclosure plugin demo')

  const university = await getOrCreateDid(agent, 'university-of-pisa-sdr')
  const alice = await getOrCreateDid(agent, 'alice-sdr')
  const jobRecruiter = await getOrCreateDid(agent, 'job-recruiter-sdr')

  const degreeClaims: DegreeClaims = {
    id: alice.did,
    fullName: 'Alice Rossi',
    degreeName: 'Laurea Magistrale in Informatica',
    degreeClass: 'LM-18',
    graduationDate: '2026-10-11',
    finalGrade: '110/110 e lode',
  }

  const degreeCredentialPayload: CredentialPayload = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: { id: university.did },
    issuanceDate: new Date().toISOString(),
    credentialSubject: degreeClaims,
  }

  const degreeVC: W3CVerifiableCredential = await agent.createVerifiableCredential({
    credential: degreeCredentialPayload,
    proofFormat: 'jwt',
  })

  await agent.dataStoreSaveVerifiableCredential({
    verifiableCredential: degreeVC,
  })

  console.log('\n1. Job Recruiter creates a Selective Disclosure Request (SDR)')
  const selectiveDisclosureRequest: ISelectiveDisclosureRequest = {
    issuer: jobRecruiter.did,
    subject: alice.did,
    tag: 'junior-blockchain-ssi-engineer-application',
    claims: [
      {
        reason: 'The role requires a degree in computer science or an equivalent class.',
        essential: true,
        credentialType: 'UniversityDegreeCredential',
        claimType: 'degreeClass',
        claimValue: 'LM-18',
        issuers: [{ did: university.did, url: 'https://www.unipi.it' }],
      },
      {
        reason: 'The role is technical, so the degree name must be related to Informatica.',
        essential: true,
        credentialType: 'UniversityDegreeCredential',
        claimType: 'degreeName',
        claimValue: 'Laurea Magistrale in Informatica',
        issuers: [{ did: university.did, url: 'https://www.unipi.it' }],
      },
      {
        reason: 'The recruiter needs the graduation date for eligibility screening.',
        essential: true,
        credentialType: 'UniversityDegreeCredential',
        claimType: 'graduationDate',
        claimValue: '2026-10-11',
        issuers: [{ did: university.did, url: 'https://www.unipi.it' }],
      },
    ],
  }

  const selectiveDisclosureRequestJwt = await agent.createSelectiveDisclosureRequest({
    data: structuredClone(selectiveDisclosureRequest),
  })
  console.log('SDR JWT created:', selectiveDisclosureRequestJwt.split('.').length === 3)

  console.log('\n2. Alice asks the plugin to find matching local credentials')
  const { issuer: _requestIssuer, ...sdrWithoutIssuer } = selectiveDisclosureRequest
  const credentialsForSdr = await agent.getVerifiableCredentialsForSdr({
    sdr: sdrWithoutIssuer,
    did: alice.did,
  })
  console.log(
    credentialsForSdr.map((claim) => ({
      claimType: claim.claimType,
      claimValue: claim.claimValue,
      matches: claim.credentials.length,
    })),
  )

  const selectedCredentialByHash = new Map<string, W3CVerifiableCredential>()
  for (const claimMatch of credentialsForSdr) {
    for (const match of claimMatch.credentials) {
      selectedCredentialByHash.set(match.hash, match.verifiableCredential)
    }
  }
  const selectedCredentials = [...selectedCredentialByHash.values()]

  console.log('\n3. Alice creates a VP response containing the matching credential')
  const responsePayload: PresentationPayload = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    holder: alice.did,
    verifier: [jobRecruiter.did],
    verifiableCredential: selectedCredentials,
  }

  const selectiveDisclosureResponse: W3CVerifiablePresentation = await agent.createVerifiablePresentation({
    presentation: responsePayload,
    proofFormat: 'jwt',
  })

  if (typeof selectiveDisclosureResponse === 'string') {
    throw new Error('Expected object VP for SDR validation, received compact JWT.')
  }

  console.log('\n4. Job Recruiter validates the VP against the original SDR')
  const selectiveDisclosureValidation = await agent.validatePresentationAgainstSdr({
    sdr: selectiveDisclosureRequest,
    presentation: selectiveDisclosureResponse,
  })

  const summary: SelectiveDisclosurePluginSummary = {
    requestJwtCreated: selectiveDisclosureRequestJwt.split('.').length === 3,
    requestedClaims: selectiveDisclosureRequest.claims.map((claim) => claim.claimType),
    matchingCredentialCounts: credentialsForSdr.map((claim) => claim.credentials.length),
    responseCredentialCount: selectedCredentials.length,
    presentationMatchesRequest: selectiveDisclosureValidation.valid,
  }

  console.log('\n--- Selective Disclosure plugin summary ---')
  console.log(summary)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
