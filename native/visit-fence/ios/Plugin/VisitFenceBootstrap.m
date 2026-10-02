#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@interface VisitFenceBootstrap : NSObject
+ (void)start;
@end

@interface VisitFenceLaunch : NSObject
@end

@implementation VisitFenceLaunch

+ (void)load {
    [[NSNotificationCenter defaultCenter]
        addObserverForName:UIApplicationDidFinishLaunchingNotification
                    object:nil
                     queue:[NSOperationQueue mainQueue]
                usingBlock:^(__unused NSNotification *note) {
        [VisitFenceBootstrap start];
    }];
}

@end
