/**
 * Typed failures of the transcription pipeline. The API route maps each of
 * these to a status code and a user-facing message; anything else is a 500.
 */

/** The video has no audio track to transcribe. */
export class NoAudioError extends Error {
  constructor(message = "This video has no audio track to transcribe.") {
    super(message);
    this.name = "NoAudioError";
  }
}

/** The STT engine ran but produced no words (silence, music only, …). */
export class EmptyTranscriptError extends Error {
  constructor(
    message = "We couldn't detect any speech in this video's audio."
  ) {
    super(message);
    this.name = "EmptyTranscriptError";
  }
}

/** The STT engine failed (provider error, timeout, bad response …). */
export class TranscriptionFailedError extends Error {
  constructor(
    message = "Transcription failed. Please try again in a moment."
  ) {
    super(message);
    this.name = "TranscriptionFailedError";
  }
}

/** No STT engine is configured on this server. */
export class TranscriptionNotConfiguredError extends Error {
  constructor(
    message = "Transcription is not configured on this server. Set OPENAI_API_KEY or GROQ_API_KEY (or CAPTIONFORGE_STT_ENGINE=fake for development)."
  ) {
    super(message);
    this.name = "TranscriptionNotConfiguredError";
  }
}
