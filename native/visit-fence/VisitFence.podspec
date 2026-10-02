require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'VisitFence'
  s.version = package['version']
  s.summary = 'Customer visit geofences'
  s.license = 'MIT'
  s.homepage = 'https://github.com/thenaturelover343-jpg/Team-app'
  s.author = 'Barlicious'
  s.source = { :git => 'https://github.com/thenaturelover343-jpg/Team-app.git', :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m}'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
