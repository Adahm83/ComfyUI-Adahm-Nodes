"""A1111-compatible legacy DPM++ SDE sampler.

This deliberately uses ComfyUI's public custom-sampling path.  The legacy
mode is represented by injecting k-diffusion's ordinary seeded noise sampler;
current ComfyUI otherwise creates a BrownianTreeNoiseSampler internally.
"""

import torch


def _legacy_sampler(model, noise, sigmas, extra_args=None, callback=None, disable=None):
    from comfy.k_diffusion import sampling as k_sampling

    extra_args = extra_args or {}
    noise_sampler = k_sampling.default_noise_sampler(
        noise, seed=extra_args.get("seed")
    )
    return k_sampling.sample_dpmpp_sde(
        model,
        noise,
        sigmas,
        extra_args=extra_args,
        callback=callback,
        disable=disable,
        noise_sampler=noise_sampler,
    )


class LegacyDPMppSDEAdahm:
    """Run A1111's legacy DPM++ SDE compatibility path."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "model": ("MODEL",),
            "seed": ("INT", {"default": 5775662, "min": 0, "max": 0xffffffffffffffff, "control_after_generate": True}),
            "ensd": ("INT", {"default": 31337, "min": 0, "max": 0xffffffffffffffff}),
            "steps": ("INT", {"default": 30, "min": 1, "max": 10000}),
            "cfg": ("FLOAT", {"default": 9.0, "min": 0.0, "max": 100.0, "step": 0.1}),
            "denoise": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
            "positive": ("CONDITIONING",),
            "negative": ("CONDITIONING",),
            "latent_image": ("LATENT",),
        }}

    RETURN_TYPES = ("LATENT",)
    RETURN_NAMES = ("latent",)
    FUNCTION = "sample"
    CATEGORY = "Adahm/sampling"
    DESCRIPTION = "A1111 legacy DPM++ SDE: GPU initial noise, ENSD seed delta, legacy SDE noise, and old Karras sigmas."

    def sample(self, model, seed, ensd, steps, cfg, positive, negative, latent_image, denoise):
        import comfy.model_management
        import comfy.samplers
        import comfy.sample
        from comfy.k_diffusion import sampling as k_sampling

        latent = latent_image["samples"]
        if denoise <= 0.0:
            return (latent_image.copy(),)
        device = model.load_device
        generator = torch.Generator(device=device)
        generator.manual_seed(int(seed))
        noise = torch.randn(
            latent.shape,
            dtype=latent.dtype,
            layout=latent.layout,
            device=device,
            generator=generator,
        )
        schedule_steps = int(steps) if denoise >= 0.9999 else int(steps / denoise)
        full_sigmas = k_sampling.get_sigmas_karras(
            n=schedule_steps,
            sigma_min=0.1,
            sigma_max=10.0,
            rho=7.0,
            device=device,
        )
        sigmas = full_sigmas if denoise >= 0.9999 else full_sigmas[-(int(steps) + 1):]
        sampler = comfy.samplers.KSAMPLER(_legacy_sampler)
        samples = comfy.sample.sample_custom(
            model,
            noise,
            float(cfg),
            sampler,
            sigmas,
            positive,
            negative,
            latent,
            noise_mask=latent_image.get("noise_mask"),
            seed=int(seed) + int(ensd),
        )
        output = latent_image.copy()
        output["samples"] = samples
        return (output,)
