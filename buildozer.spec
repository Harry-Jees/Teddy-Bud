[app]
title = Teddy Bud
package.name = teddybud
package.domain = org.teddybud
source.dir = .
source.include_exts = py,png,jpg,jpeg,kv,atlas,sql,ttf,txt
version = 0.1.0
requirements = python3,kivy,cryptography,keyring,sqlcipher3
orientation = portrait,landscape
fullscreen = 0
android.api = 34
android.minapi = 24

# The production database requires a platform SecureKeyStore implementation.
# Do not ship a plaintext-storage fallback. Validate SQLCipher availability
# with the Android toolchain before producing a release artifact.
