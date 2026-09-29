"""Central client-side registry for the Worker model catalog."""

from __future__ import annotations

from dataclasses import dataclass

from .models import ModelConfig, ModelPurpose, TaskType


@dataclass(frozen=True, slots=True)
class TaskRoute:
    task: TaskType
    purpose: ModelPurpose
    gateway_operation: str


class ModelRegistry:
    def __init__(self, models: tuple[ModelConfig, ...] | None = None):
        self._models = {model.purpose: model for model in (models or self.default_models())}

    @staticmethod
    def default_models() -> tuple[ModelConfig, ...]:
        return (
            ModelConfig("deepseek-ai/deepseek-v4.1-flash", ModelPurpose.EMOTIONAL_CONVERSATION),
            ModelConfig("nvidia/nemotron-3.5-lightning-30b-a3b", ModelPurpose.FAST_CONVERSATION),
            ModelConfig("openai/gpt-oss-20b", ModelPurpose.STRUCTURED_EXTRACTION),
            ModelConfig("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", ModelPurpose.MULTIMODAL),
        )

    @classmethod
    def default(cls) -> "ModelRegistry":
        return cls()

    def model_for(self, purpose: ModelPurpose) -> ModelConfig:
        return self._models[purpose]

    def route_for(self, task: TaskType) -> TaskRoute:
        purpose = {
            TaskType.CONVERSATION: ModelPurpose.EMOTIONAL_CONVERSATION,
            TaskType.MEMORY_EXTRACTION: ModelPurpose.STRUCTURED_EXTRACTION,
            TaskType.SUMMARIZATION: ModelPurpose.FAST_CONVERSATION,
            TaskType.SAFETY_REVIEW: ModelPurpose.STRUCTURED_EXTRACTION,
        }[task]
        return TaskRoute(task, purpose, "chat_completions")

    def update_from_gateway(self, models: list[dict]) -> None:
        available = {item.get("id") for item in models if isinstance(item, dict)}
        self._models = {purpose: model for purpose, model in self._models.items() if model.model_id in available}

