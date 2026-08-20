import { rpc, xdr, Address } from '@stellar/stellar-sdk';
import { config } from './config';

export class RpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RpcError';
  }
}

let serverInstance: rpc.Server | null = null;

function getServer(): rpc.Server {
  if (!serverInstance) {
    serverInstance = new rpc.Server(config.STELLAR_RPC_URL);
  }
  return serverInstance;
}

export async function resolveWasmHash(contractId: string): Promise<string> {
  let address: Address;
  try {
    address = Address.fromString(contractId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid contract ID: ${msg}`);
  }

  const ledgerKey = xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
    contract: address.toScAddress(),
    key: xdr.ScVal.scvLedgerKeyContractInstance(),
    durability: xdr.ContractDataDurability.persistent(),
  }));

  const server = getServer();
  let result;
  try {
    result = await server.getLedgerEntries(ledgerKey);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new RpcError(`RPC call failed: ${msg}`);
  }

  if (!result.entries || result.entries.length === 0) {
    throw new Error(`Contract not found on network`);
  }

  try {
    const entryData = result.entries[0].val;
    const contractData = entryData.contractData();
    const scVal = contractData.val();
    const instance = scVal.instance();
    const executable = instance.executable();
    const wasmHash = executable.wasmHash();
    return wasmHash?.toString('hex') ?? '';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse contract data: ${msg}`);
  }
}
