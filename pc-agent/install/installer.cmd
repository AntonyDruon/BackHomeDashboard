@echo off
rem Installe HomeDashboard Agent (demande les droits administrateur)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%~dp0installer.ps1\"'"
