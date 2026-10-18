Pod::Spec.new do |s|
  s.name = 'LumenLAN'
  s.version = '0.1.0'
  s.summary = 'Device-scoped local HTTPS and Hue events for Lumen'
  s.description = s.summary
  s.license = 'GPL-3.0-only'
  s.author = 'Lumen contributors'
  s.homepage = 'https://github.com/bentsignal/lumen'
  s.platforms = { :ios => '16.4' }
  s.source = { git: '' }
  s.static_framework = true
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
