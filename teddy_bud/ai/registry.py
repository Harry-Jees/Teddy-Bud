"""Central client-side task registry.

The registry describes application intent only. It does not contain NVIDIA
credentials or hardcoded NVIDIA model choices; the gateway makes that choice.
"""

from __future__ import annotations

from dataclasses import dataclass

from .models import TaskType


@dataclass(frozen=True, slots=True)
class TaskRoute:
    task: TaskType
    gateway_operation: str


class ModelRegistry:
    def __init__(self, routes: tuple[TaskRoute, ...]):
        self._routes = {route.task: route for route in routes}

    @classmethod
    def default(cls) -> "ModelRegistry":
        return cls(tuple(TaskRoute(task, task.value) for task in TaskType))

    def route_for(self, task: TaskType) -> TaskRoute:
        try:
            return self._routes[task]
        except KeyError as exc:
            raise ValueError(f"Unsupported AI task: {task}") from exc

