@echo off
if defined GSTACK_ROOT (
  node "%GSTACK_ROOT%\bin\gstack-dispatch.mjs" %*
) else (
  node "%USERPROFILE%\.gemini\gstack\bin\gstack-dispatch.mjs" %*
)
