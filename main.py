import os

# On Windows systems without a native OpenGL driver, use Kivy's bundled
# ANGLE/Direct3D backend. This avoids the GDI Generic OpenGL 1.1 fallback.
os.environ.setdefault("KIVY_GL_BACKEND", "angle_sdl2")

from teddy_bud.app.app import TeddyBudApp


if __name__ == "__main__":
    TeddyBudApp().run()

