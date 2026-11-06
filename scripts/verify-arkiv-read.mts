  // Section 9 verification: Arkiv read access without a wallet.
import { createPublicClient } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { http } from "viem"
import { gt } from "@arkiv-network/sdk/query"
import { u64 } from "@arkiv-network/sdk/schema"

const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" })
const client = createPublicClient({ chain, transport: http() })
const block = await client.getBlockNumber()
console.log("Rabdi head block:", block)
const timing = await client.getBlockTiming().catch((e: unknown) => String(e))
console.log("Block timing:", timing)
const page = await client.select({ $key: true, $owner: true, $expiresAt: true }).where(gt("$expiresAt", u64(0))).limit(3).fetch()
console.log("Sample entities:", page.entities.length)
