Pod::Spec.new do |s|
  s.name           = 'CarFinder'
  s.version        = '1.0.0'
  s.summary        = 'Finds the subject of a photo on the phone (Vision saliency)'
  s.description    = 'Returns the bounding box of the most eye-catching object in a photo so the scan frame can lock onto the car before the AI answers.'
  s.license        = 'MIT'
  s.author         = 'Carbix'
  s.homepage       = 'https://motordex.pages.dev'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision', 'UIKit'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  s.source_files = "**/*.{h,m,swift}"
end
