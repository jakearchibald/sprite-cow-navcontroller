/*global module:false*/
module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-sass');
  
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      jsfiles: [
        'www/static/js/jquery-1.7.1.js',
        'www/static/js/jquery.easing.js',
        'www/static/js/jquery.transition.js',
        'www/static/js/jquery.fileClickjack.js',
        'www/static/js/intro.js',
        'www/static/js/MicroEvent.js',
        'www/static/js/Rect.js',
        'www/static/js/ImgInput.js',
        'www/static/js/SpriteCanvas.js',
        'www/static/js/SpriteCanvasView.js',
        'www/static/js/InlineEdit.js',
        'www/static/js/CssOutput.js',
        'www/static/js/Toolbar.js',
        'www/static/js/pageLayout.js',
        'www/static/js/FeatureTest.js',
        'www/static/js/featureTests.js',
        'www/static/js/base.js'
      ],
      controllerFiles: [
        'www/static/js/navcontroller-polyfills/url.js',
        'www/static/js/navcontroller-polyfills/fetch.js',
        'www/static/js/navcontroller-polyfills/cache.js',
        'www/static/js/controller-main.js'
      ]
    },
    uglify: {
      all: {
        options: {
          sourceMap: function(path) {
            return path + '.map';
          },
          sourceMappingURL: function(path) {
            return path.slice(3);
          }
        },
        files: {
          'www/static/js/all.js': '<%= meta.jsfiles %>'
        }
      }
    },
    concat: {
      options: {
        separator: '\n;\n'
      },
      all: {
        files: {
          'www/static/js/controller.js': '<%= meta.controllerFiles %>'
        }
      }
    },
    sass: {
      dev: {
        options: {
          sourcemap: true,
          style: 'compressed'
        },
        files: {
          'www/static/css/all.css': 'www/static/css/all.scss'
        }
      }
    },
    watch: {
      scripts: {
        files: '<%= meta.jsfiles %>',
        tasks: ['uglify']
      },
      controller: {
        files: '<%= meta.controllerFiles %>',
        tasks: ['concat']
      },
      styles: {
        files: 'www/static/css/*.scss',
        tasks: ['sass:dev']
      }
    }
  });

  grunt.registerTask('server', function() {
    require('./index.js');
  });

  grunt.registerTask('buildStatic', function() {
    var done = this.async();
    require('./build-static.js')(done);
  });

  grunt.registerTask('dev', ['sass:dev', 'uglify', 'concat', 'server', 'watch']);
  grunt.registerTask('build', ['sass:dev', 'uglify', 'concat', 'server', 'buildStatic']);

};
