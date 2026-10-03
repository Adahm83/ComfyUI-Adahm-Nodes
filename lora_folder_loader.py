# SPDX-License-Identifier: GPL-3.0-only
# Adahm contributions: Copyright (c) 2026 Adahm83.
# Power LoRA Loader format and flexible-input approach: rgthree-comfy,
# Copyright (c) 2023 Regis Gaughan, III (rgthree), MIT; notice retained in
# THIRD_PARTY_NOTICES.md. rgthree's AnyType helper credits pythongosssss.
# https://github.com/rgthree/rgthree-comfy
# Adahm modifications (2026-10-03): folder population, stack text, and local
# metadata/preview support. See LICENSE. Provided without warranty.

"""Power LoRA Loader-style node with folder population support."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Iterable

try:
    import folder_paths
except Exception:  # pragma: no cover - only used outside ComfyUI
    folder_paths = None

try:
    import comfy.sd
    import comfy.utils
except Exception:  # pragma: no cover - only used outside ComfyUI
    comfy = None

try:
    from server import PromptServer
except Exception:  # pragma: no cover - only used outside ComfyUI
    PromptServer = None


ROOT_FOLDER = "[root]"
_LORA_ROUTE_REGISTERED = False
_PREVIEW_SUFFIXES = (
    ".preview.png",
    ".preview.jpg",
    ".preview.jpeg",
    ".preview.webp",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
)


def _normalise_name(value: str) -> str:
    return str(value).replace("\\", "/").strip("/")


def folder_options(names: Iterable[str]) -> list[str]:
    """Return the root and every selectable folder represented by filenames."""

    folders = {ROOT_FOLDER}
    for raw_name in names:
        name = _normalise_name(raw_name)
        parts = [part for part in name.split("/") if part]
        folders.update("/".join(parts[:index]) for index in range(1, len(parts)))
    return sorted(folders, key=lambda item: (item != ROOT_FOLDER, item.casefold()))


def matching_loras(names: Iterable[str], folder: str, recursive: bool) -> list[str]:
    """Select LoRA filenames directly below, or below, a registered folder."""

    selected = "" if folder in (None, "", ROOT_FOLDER) else _normalise_name(folder)
    result: list[str] = []
    for raw_name in names:
        name = _normalise_name(raw_name)
        if not selected:
            if recursive or "/" not in name:
                result.append(raw_name)
            continue
        prefix = selected + "/"
        if not name.startswith(prefix):
            continue
        remainder = name[len(prefix) :]
        if recursive or "/" not in remainder:
            result.append(raw_name)
    return sorted(result, key=lambda item: str(item).casefold())


def build_lora_rows(
    names: Iterable[str], strength_model: float = 1.0, strength_clip: float | None = None
) -> list[dict[str, Any]]:
    """Build the serialized row values used by rgthree's Power loader."""

    clip_strength = strength_model if strength_clip is None else strength_clip
    rows: list[dict[str, Any]] = []
    for name in names:
        row: dict[str, Any] = {
            "on": True,
            "lora": name,
            "strength": float(strength_model),
        }
        if clip_strength != strength_model:
            row["strengthTwo"] = float(clip_strength)
        rows.append(row)
    return rows


def serialise_lora_rows(rows: Iterable[dict[str, Any]]) -> str:
    """Serialize rows for diagnostics and compatibility with existing callers."""

    return json.dumps(list(rows), separators=(",", ":"))


def _format_stack_strength(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = 1.0
    if number != number or number in (float("inf"), float("-inf")):
        number = 1.0
    if number == 0:
        number = 0.0
    text = str(number)
    return text if "." in text or "e" in text.lower() else f"{text}.0"


def _stack_folder_and_name(value: str) -> tuple[str, str]:
    parts = [part for part in _normalise_name(value).split("/") if part]
    if not parts:
        return ROOT_FOLDER, ""
    name = parts[-1]
    folder = "\\".join(parts[:-1]) or ROOT_FOLDER
    return folder, name


def build_stack_text(rows: Iterable[dict[str, Any]]) -> str:
    """Return enabled LoRAs grouped by folder in application order."""

    groups: dict[str, list[str]] = {}
    for row in rows:
        if not row.get("lora") or str(row.get("on", True)).strip().lower() in {
            "false",
            "0",
            "off",
            "no",
        }:
            continue
        folder, name = _stack_folder_and_name(row["lora"])
        groups.setdefault(folder, []).append(
            f"{name}: {_format_stack_strength(row.get('strength', 1.0))}  "
        )

    text = "\n".join(
        f"### {folder}\n" + "\n".join(entries)
        for folder, entries in groups.items()
    )
    return f"{text}\n\n" if text else ""


def _available_loras() -> list[str]:
    if folder_paths is None:
        return []
    return list(folder_paths.get_filename_list("loras"))


def _list_loras(folder: str, recursive: bool) -> list[str]:
    return matching_loras(_available_loras(), folder, recursive)


def _resolve_lora_path(name: str) -> Path:
    """Resolve a registered LoRA and keep metadata routes inside LoRA roots."""

    if folder_paths is None:
        raise ValueError("ComfyUI folder paths are unavailable")
    normalised = _normalise_name(name)
    full_path = folder_paths.get_full_path("loras", normalised)
    if not full_path:
        raise ValueError(f"LoRA file was not found: {name}")
    path = Path(os.path.abspath(full_path))
    roots = [Path(os.path.abspath(root)) for root in folder_paths.get_folder_paths("loras")]
    if not any(root in path.parents for root in roots):
        raise ValueError("LoRA path is outside the registered LoRA folders")
    return path


def _find_lora_preview(name: str) -> Path | None:
    try:
        path = _resolve_lora_path(name)
    except ValueError:
        return None
    stem = path.with_suffix("")
    for suffix in _PREVIEW_SUFFIXES:
        candidate = Path(f"{stem}{suffix}")
        if candidate.is_file():
            return candidate
    return None


def _read_safetensors_metadata(path: Path) -> dict[str, Any]:
    """Read only the safetensors header metadata, never the tensor payload."""

    if path.suffix.lower() != ".safetensors":
        return {}
    try:
        with path.open("rb") as handle:
            raw_size = handle.read(8)
            if len(raw_size) != 8:
                return {}
            header_size = int.from_bytes(raw_size, "little")
            if header_size <= 0 or header_size > 100 * 1024 * 1024:
                return {}
            header = json.loads(handle.read(header_size))
        metadata = header.get("__metadata__")
        return metadata if isinstance(metadata, dict) else {}
    except Exception:
        return {}


def _metadata_words(metadata: dict[str, Any]) -> list[str]:
    for key in ("modelspec.trigger_phrase", "ss_trigger_words"):
        value = str(metadata.get(key) or "").strip()
        if value:
            return [word.strip() for word in value.split(",") if word.strip()][:20]
    frequency = metadata.get("ss_tag_frequency")
    if isinstance(frequency, str):
        try:
            frequency = json.loads(frequency)
        except json.JSONDecodeError:
            return []
    if not isinstance(frequency, dict):
        return []
    totals: dict[str, int] = {}
    for dataset in frequency.values():
        if not isinstance(dataset, dict):
            continue
        for tag, count in dataset.items():
            if isinstance(count, (int, float)):
                clean_tag = str(tag).strip()
                if clean_tag:
                    totals[clean_tag] = totals.get(clean_tag, 0) + int(count)
    ranked = sorted(totals.items(), key=lambda item: (-item[1], item[0]))
    return [tag for tag, _ in ranked[:8]]


def _suggested_range(name: str) -> dict[str, float] | None:
    """Read an existing optional AusBoss advisory range without adding controls."""

    if folder_paths is None:
        return None
    try:
        store = Path(folder_paths.get_user_directory()) / "ausboss" / "lora_triggers.json"
        data = json.loads(store.read_text(encoding="utf-8")) if store.is_file() else {}
        entry = data.get(name) if isinstance(data, dict) else None
        if not isinstance(entry, dict):
            return None
        result: dict[str, float] = {}
        for key in ("min", "max"):
            value = float(entry[key]) if entry.get(key) is not None else None
            if value is not None and value == value and abs(value) <= 10:
                result[key] = value
        return result or None
    except (OSError, TypeError, ValueError, json.JSONDecodeError):
        return None


def _metadata_base_model(metadata: dict[str, Any]) -> str:
    value = " ".join(
        str(metadata.get(key) or "")
        for key in ("modelspec.architecture", "ss_base_model_version")
    ).lower()
    for needle, family in (
        ("flux", "Flux"),
        ("sd3", "SD3"),
        ("xl", "SDXL"),
        ("v2", "SD2"),
        ("v1", "SD1.5"),
    ):
        if needle in value:
            return family
    declared = str(
        metadata.get("modelspec.architecture")
        or metadata.get("ss_base_model_version")
        or ""
    ).strip()
    return declared.split("/")[0].strip()


def _civitai_sidecar(name: str) -> dict[str, Any]:
    """Read a local Civitai sidecar; no online Civitai request is made."""

    try:
        sidecar = _resolve_lora_path(name).with_suffix(".civitai.info")
        if not sidecar.is_file():
            return {}
        data = json.loads(sidecar.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}
    model = data.get("model") if isinstance(data.get("model"), dict) else {}
    raw_words = data.get("trainedWords", data.get("trained_words", []))
    words = (
        [str(word).strip() for word in raw_words if str(word).strip()][:40]
        if isinstance(raw_words, list)
        else []
    )
    model_id = data.get("modelId", data.get("model_id"))
    version_id = data.get("id", data.get("version_id"))
    return {
        "title": str(model.get("name") or data.get("title") or data.get("name") or ""),
        "base_model": str(data.get("baseModel") or data.get("base_model") or ""),
        "trained_words": words,
        "model_id": int(model_id) if str(model_id).isdigit() else None,
        "version_id": int(version_id) if str(version_id).isdigit() else None,
    }


def _lora_info(name: str) -> dict[str, Any]:
    path = _resolve_lora_path(name)
    metadata = _read_safetensors_metadata(path)
    civitai = _civitai_sidecar(name)
    stat = path.stat()
    return {
        "name": name,
        "size_bytes": stat.st_size,
        "mtime": stat.st_mtime,
        "base_model": _metadata_base_model(metadata) or civitai.get("base_model", ""),
        "file_triggers": _metadata_words(metadata),
        "civitai_triggers": civitai.get("trained_words", []),
        "civitai_title": civitai.get("title", ""),
        "civitai_model_id": civitai.get("model_id"),
        "civitai_version_id": civitai.get("version_id"),
        "range": _suggested_range(name),
        "has_preview": _find_lora_preview(name) is not None,
    }


def register_lora_folder_routes() -> None:
    """Expose the selected-folder list to the frontend without changing ComfyUI core."""

    global _LORA_ROUTE_REGISTERED
    if _LORA_ROUTE_REGISTERED or PromptServer is None:
        return
    server = getattr(PromptServer, "instance", None)
    if server is None:
        return

    try:
        from aiohttp import web

        @server.routes.get("/adahm/lora/list")
        async def adahm_lora_list(request):
            folder = request.query.get("folder", ROOT_FOLDER)
            recursive = request.query.get("recursive", "false").lower() in {"1", "true", "yes"}
            return web.json_response({"loras": _list_loras(folder, recursive)})

        @server.routes.get("/adahm/lora/thumb")
        async def adahm_lora_thumb(request):
            preview = _find_lora_preview(request.query.get("name", ""))
            if preview is None:
                return web.json_response({"error": "no preview image"}, status=404)
            return web.FileResponse(str(preview), headers={"Cache-Control": "max-age=3600"})

        @server.routes.get("/adahm/lora/info")
        async def adahm_lora_info(request):
            try:
                return web.json_response({"ok": True, "info": _lora_info(request.query.get("name", ""))})
            except Exception as exc:
                return web.json_response({"ok": False, "error": str(exc)}, status=400)

        _LORA_ROUTE_REGISTERED = True
    except Exception:
        # The normal ComfyUI combo remains usable if server registration happens
        # before PromptServer has finished setting up its route table.
        return


def _row_values(kwargs: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for key, value in kwargs.items():
        if not key.lower().startswith("lora_") or not isinstance(value, dict):
            continue
        if value.get("lora"):
            rows.append(value)
    return rows


class _AnyType(str):
    def __ne__(self, other):
        return False


_ANY_TYPE = _AnyType("*")


class _FlexibleOptionalInputType(dict):
    """Accept the fixed model/CLIP inputs and serialized dynamic LoRA widgets."""

    def __init__(self):
        super().__init__(model=("MODEL",), clip=("CLIP",))

    def __contains__(self, key):
        return True

    def __getitem__(self, key):
        return super().get(key, (_ANY_TYPE,))


class LoraFolderLoaderAdahm:
    """An rgthree Power LoRA Loader-compatible node with folder population."""

    CATEGORY = "Adahm/loaders"
    DESCRIPTION = (
        "Power LoRA Loader-style stack. Select a folder, add individual LoRAs, "
        "or populate the stack with every LoRA in the selected folder."
    )
    RETURN_TYPES = ("MODEL", "CLIP", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "stack_text")
    FUNCTION = "load_loras"

    @classmethod
    def INPUT_TYPES(cls):
        names = _available_loras()
        optional_type = getattr(cls, "_optional_type", None)
        if optional_type is None:
            optional_type = _FlexibleOptionalInputType()
            cls._optional_type = optional_type

        return {
            "required": {
                "folder": (folder_options(names), {"default": ROOT_FOLDER}),
                "recursive": ("BOOLEAN", {"default": False}),
            },
            "optional": optional_type,
        }

    @staticmethod
    def _load_lora(path: str):
        if comfy is None:
            raise RuntimeError("ComfyUI is required to load LoRAs")
        return comfy.utils.load_torch_file(path, safe_load=True, return_metadata=True)

    def load_loras(self, model=None, clip=None, **kwargs):
        """Apply enabled dynamic rows in their visible order, like rgthree."""

        rows = _row_values(kwargs)
        serialized_stack_text = kwargs.get("__adahm_stack_text")
        stack_text = (
            serialized_stack_text
            if isinstance(serialized_stack_text, str)
            else build_stack_text(rows)
        )
        if model is None:
            return (model, clip, stack_text)

        for row in rows:
            if row.get("on", True) is False:
                continue

            strength_model = float(row.get("strength", 1.0))
            strength_clip = row.get("strengthTwo", strength_model)
            strength_clip = 0.0 if clip is None else float(strength_clip)
            if strength_model == 0.0 and strength_clip == 0.0:
                continue

            name = str(row["lora"])
            path = folder_paths.get_full_path("loras", name) if folder_paths is not None else None
            if path is None:
                continue

            loaded = self._load_lora(path)
            if isinstance(loaded, tuple) and len(loaded) == 2:
                state_dict, metadata = loaded
            else:
                state_dict, metadata = loaded, None
            model, clip = comfy.sd.load_lora_for_models(
                model,
                clip,
                state_dict,
                strength_model,
                strength_clip,
                lora_metadata=metadata,
            )

        return (model, clip, stack_text)


register_lora_folder_routes()


NODE_CLASS_MAPPINGS = {"AdahmLoraFolderLoader": LoraFolderLoaderAdahm}
NODE_DISPLAY_NAME_MAPPINGS = {"AdahmLoraFolderLoader": "Adahm LoRA Folder Loader"}
