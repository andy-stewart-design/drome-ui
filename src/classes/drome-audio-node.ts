abstract class DromeAudioNode {
  protected abstract _input: AudioNode;

  abstract connect(dest: AudioNode): void;
  abstract disconnect(): void;
  abstract get input(): AudioNode;
}

export default DromeAudioNode;
