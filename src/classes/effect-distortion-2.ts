// import DromeEffect, { type DromeEffectOptions } from "./effect-drome";
// import * as algos from "../utils/distortion-algorithms";
// import type Drome from "./drome";

// type DistortionAlgorithm = keyof typeof algos;

// interface BitcrusherEffectOptions extends DromeEffectOptions {
//   distortion?: number;
//   postgain?: number;
//   type: DistortionAlgorithm
// }

// class BitcrusherEffect extends DromeEffect {
// //   private bcNode: AudioWorkletNode;

//   constructor(
//     drome: Drome,
//     { distortion, postgain, type }: BitcrusherEffectOptions = {}
//   ) {
//     // super(drome, { mix, variableDry: true });

//     // this.bcNode = new AudioWorkletNode(drome.ctx, "distortion-processor");
//     // this.bitDepth(bitDepth);
//     // this.rateReduction(rateReduction);

//     // // Dry path
//     // this.input.connect(this._dry);

//     // // Wet path
//     // this.input.connect(this.bcNode).connect(this._wet);
//   }

// //   bitDepth(v: number) {
// //     this.bitParam.value = v;
// //   }

// //   rateReduction(v: number) {
// //     this.rateParam.value = v;
// //   }

// //   get bitParam() {
// //     const param = this.bcNode.parameters.get("bitDepth");
// //     if (!param)
// //       throw new Error("[BitcrusherEffect] couldn't get 'bitDepth' param");
// //     return param;
// //   }

// //   get rateParam() {
// //     const param = this.bcNode.parameters.get("rateReduction");
// //     if (!param)
// //       throw new Error("[BitcrusherEffect] couldn't get 'rateReduction' param");
// //     return param;
// //   }
// // }

// export default BitcrusherEffect;
