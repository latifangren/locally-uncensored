import { describe, it, expect, vi, beforeEach } from 'vitest'

// Vision feedback: after image_generate, hand the still to a vision model so it
// SEES the result. Live 2026-06-22 (gemma4 + Wan T2V): a video_generate whose
// output is an animated .webp slipped past urlIsVideo's mp4/webm-only check and
// got fed to Ollama as an image → HTTP 400 "Failed to load image or audio file".
// Fix: only image_generate produces a feedable still — video_generate always
// no-ops, regardless of output container (mp4 / webm / animated webp / gif).

const { modelSupportsVision, fetchComfyImageBase64 } = vi.hoisted(() => ({
  modelSupportsVision: vi.fn(),
  fetchComfyImageBase64: vi.fn(),
}))

vi.mock('../ollama', () => ({ modelSupportsVision: (...a: unknown[]) => modelSupportsVision(...a) }))
vi.mock('../comfyui', () => ({ fetchComfyImageBase64: (...a: unknown[]) => fetchComfyImageBase64(...a) }))
vi.mock('../../lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { buildVisionFeedback } from '../vision-feedback'

const VIEW = (fn: string) => `http://127.0.0.1:8188/view?filename=${fn}&type=output`

beforeEach(() => {
  modelSupportsVision.mockReset()
  fetchComfyImageBase64.mockReset()
  modelSupportsVision.mockResolvedValue(true)
  fetchComfyImageBase64.mockResolvedValue('BASE64DATA')
})

describe('buildVisionFeedback — video_generate never feeds the model an image', () => {
  it('video_generate with an animated .webp output → null (the live bug: webp slipped past urlIsVideo)', async () => {
    const result = `Video generated: ocean_waves_vid_00001_.webp (prompt: "waves")\n${VIEW('ocean_waves_vid_00001_.webp')}`
    expect(await buildVisionFeedback('gemma4:e4b', 'video_generate', result)).toBeNull()
    // must NOT even fetch the file — bails on the tool name, before any image work
    expect(fetchComfyImageBase64).not.toHaveBeenCalled()
  })

  it('video_generate with .gif output → null', async () => {
    const result = `Video generated: clip.gif (prompt: "x")\n${VIEW('clip.gif')}`
    expect(await buildVisionFeedback('gemma4:e4b', 'video_generate', result)).toBeNull()
  })

  it('video_generate with .mp4 output → null', async () => {
    const result = `Video generated: clip.mp4 (prompt: "x")\n${VIEW('clip.mp4')}`
    expect(await buildVisionFeedback('gemma4:e4b', 'video_generate', result)).toBeNull()
  })
})

describe('buildVisionFeedback — image_generate still feeds a still to a vision model', () => {
  it('image_generate .png on a vision model → returns a vf message carrying the image', async () => {
    const result = `Image generated: cat.png (prompt: "a cat")\n${VIEW('cat.png')}`
    const vf = await buildVisionFeedback('gemma4:e4b', 'image_generate', result)
    expect(vf).not.toBeNull()
    expect(vf!.role).toBe('user')
    expect(vf!.images[0].data).toBe('BASE64DATA')
    expect(vf!.content).toMatch(/describe/i)
  })

  it('image_generate .webp STILL is still fed (webp is a valid still image — do not over-block)', async () => {
    const result = `Image generated: art.webp (prompt: "art")\n${VIEW('art.webp')}`
    expect(await buildVisionFeedback('gemma4:e4b', 'image_generate', result)).not.toBeNull()
  })

  it('text-only model → null (no useless base64 blob)', async () => {
    modelSupportsVision.mockResolvedValue(false)
    const result = `Image generated: cat.png (prompt: "x")\n${VIEW('cat.png')}`
    expect(await buildVisionFeedback('qwen2.5-coder:14b', 'image_generate', result)).toBeNull()
  })

  it('non-generation tool → null', async () => {
    expect(await buildVisionFeedback('gemma4:e4b', 'web_search', 'some search text')).toBeNull()
  })

  it('no ComfyUI /view url in the result → null', async () => {
    expect(await buildVisionFeedback('gemma4:e4b', 'image_generate', 'Image generated: x.png (no url here)')).toBeNull()
  })
})
