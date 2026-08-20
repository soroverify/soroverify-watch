import { config } from './config';

class RpcBudget {
  private remaining: number = 0;
  private totalConsumed: number = 0;

  reset() {
    this.remaining = config.RPC_CALLS_PER_TICK;
  }

  canConsume(): boolean {
    return this.remaining > 0;
  }

  consume() {
    if (this.remaining <= 0) {
      throw new Error('RPC budget exceeded for this tick');
    }
    this.remaining--;
    this.totalConsumed++;
  }

  getRemaining(): number {
    return this.remaining;
  }

  getTotalConsumed(): number {
    return this.totalConsumed;
  }
}

export const rpcBudget = new RpcBudget();
