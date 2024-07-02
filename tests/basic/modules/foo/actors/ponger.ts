import { ActorBase } from "../module.gen.ts";

interface Input {

}

interface State {
  pongs: number;
}

export class Actor extends ActorBase<Input, State> {
	public initialize(_input: Input) {
    return { pongs: 0 };
	}

  async addPong(count: number): Promise<number> {
    this.state.pongs += count;
    this.schedule.after(1000, "decreasePong", count);
    return this.state.pongs;
  }

  async decreasePong(count: number) {
    this.state.pongs -= count;
  }
}

