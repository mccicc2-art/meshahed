Pod::Spec.new do |s|
  s.name           = 'LoopzWidget'
  s.version        = '1.0.0'
  s.summary        = 'Loopz widget bridge: shared folder writes and timeline reloads'
  s.description    = 'Writes the widget feed into the App Group container and asks WidgetKit to redraw.'
  s.license        = 'UNLICENSED'
  s.author         = 'Loopz'
  s.homepage       = 'https://loopztv.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'WidgetKit'
  s.source_files   = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
