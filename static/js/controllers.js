'use strict';

function CodeCtrl($scope, $http, $location, $timeout) {
  $(document).keydown(function(event) {
    var e = window.event || event;
    if (e.keyCode == 13 && e.shiftKey) {  // shift-enter
      $scope.runCode();
    } else if (e.keyCode == 33) {  // page up
      $scope.location.path("/" + $scope.prevChapter());
      $scope.$apply();
      return false;
    } else if (e.keyCode == 34) {  // page down
      $scope.location.path("/" + $scope.nextChapter());
      $scope.$apply();
      return false;
    }
  });

  $scope.location = $location;

  // This naively assumes that the dirty state is "sticky" unless you force a
  // full recomputation. Works for most purposes in the UI.
  $scope._dirty = false;
  $scope.dirty = function(force_recompute) {
    if (force_recompute || !$scope._dirty) {
      $scope._dirty = ($scope.tutorial != undefined &&
                       $scope.code != $scope.tutorial.code);
    }
    return $scope._dirty;
  };

  $scope.storageKey = function() {
    return "pytut-" + $scope.tutorial.name;
  };

  $scope.saveCode = function() {
    if ($scope.tutorial === undefined) {
      return;
    }
    var dirty = $scope.dirty(true);

    // Save to the internal JS cache first.
    $scope.tutorial.userCode = (dirty) ? $scope.code : undefined;

    // Also save to HTML5 local storage if possible.
    // This protects users against refresh and browser crashes.
    if (typeof(Storage) != "undefined") {
      if ($scope.tutorial.userCode === undefined) {
        localStorage.removeItem($scope.storageKey());
      } else {
        localStorage[$scope.storageKey()] = JSON.stringify({
          time_ms: +new Date(),
          user_code: $scope.tutorial.userCode,
        });
      }
    }
  };

  $scope.loadCode = function() {
    if ($scope.tutorial === undefined) {
      return;
    }

    // Get from localStorage if possible.
    if (typeof(Storage) != "undefined") {
      var val = localStorage[$scope.storageKey()];
      if (val !== undefined) {
        // TODO: Age out old things?
        $scope.tutorial.userCode = JSON.parse(val).user_code;
      }
    }
    // If there is data in userCode now, then we display that. Otherwise we get
    // the tutorial code and display that.
    if ($scope.tutorial.userCode !== undefined) {
      $scope.code = $scope.tutorial.userCode;
    } else {
      $scope.code = $scope.tutorial.code;
    }
    $scope.dirty(true);  // Force dirty bit recomputation.
  };
  // TOC should be off when we start.
  $scope.tocShowing = false;

  $http.get("/tutorials").
    success(function(data) {
      $scope.tutorials = data;
      $scope.tutorial = $scope.tutorials[$scope.chapter-1];
      $scope.loadCode();

      // Redirect to the first page if none is specified.
      if (!$location.path()) {
        $location.path('/1').replace();
      }

      // Notice when the path changes and use that to
      // navigate, but only after we actually have
      // data.
      $scope.$watch('location.path()', function(path) {
        var newChapter = +path.replace(/^[/]/, '');
        if (newChapter == 0) {
          // Special value - don't go to chapter 0.
          newChapter = $scope.chapter;
          $scope.location.path("/" + $scope.chapter).replace();
        }
        $scope.tocShowing = false;
        if (newChapter != $scope.chapter) {
          $scope.saveCode();
          $scope.chapter = newChapter;
          $scope.tutorial = $scope.tutorials[newChapter-1];
          $scope.loadCode();
          $scope.clearOutput();
          $(document.body).scrollTop(0);
        }
      });
    });

  // Set up a handy timer that watches when _time changes and starts a new
  // timeout to change it. It's a bit more elegant than creating a function
  // and creating a timeout from a timeout.
  $scope._time = new Date();
  $scope.$watch('_time', function() {
    $scope.saveCode();  // Also forces dirty bit recomputation.
    $timeout(function(){
      $scope._time = new Date();
    }, 5000);
  });

  $scope.runCode = function() {
    $http.post("/runcode", $scope.code).
      success(function(data) {
        $scope.out = data.stdout;
        $scope.err = data.stderr;
        $("#output").scrollTop(0);
      });
  };

  // This is useful for binding keys in the code window to do
  // nothing at all. We can't, for whatever reason, define this
  // function in-line.
  //
  // Note that we use this for Shift-Enter because it is a
  // document-wide keystroke that should run the code, but if
  // you're in the code window it causes a newline to be
  // inserted, too.
  $scope.doNothing = function(e) {}

  $scope.clearOutput = function() {
    $scope.out = "";
    $scope.err = "";
  };

  $scope.clearCode = function() {
    $scope.code = "";
  }

  $scope.revertCode = function() {
    $scope.code = $scope.tutorial.code;
    // Force dirty bit recomputation:
    $scope.dirty(true);
  };

  $scope.revertAll = function() {
    // Remove all local storage if we have it.
    if (typeof(Storage) != "undefined") {
      localStorage.clear();
    }
    $scope.revertCode();
  };

  $scope.prevChapter = function() {
    if ($scope.tutorial == undefined || $scope.tutorial.index <= 0) {
      return 0;  // special value meaning don't go there.
    }
    return $scope.tutorial.index;  // chapter - 1
  }

  $scope.nextChapter = function() {
    if ($scope.tutorial == undefined ||
        $scope.tutorial.index >= $scope.tutorials.length - 1) {
      return 0;  // special value - don't go there.
    }
    return $scope.tutorial.index + 2;  // chapter + 1
  }
}