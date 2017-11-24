// CS 174a Project 3 Ray Tracer Skeleton
// co-produced by Pochao Yang
// UID: 204631541
// 06/11/2017

var mult_3_coeffs = function( a, b ) { return [ a[0]*b[0], a[1]*b[1], a[2]*b[2] ]; };       // Convenient way to combine two color-reducing vectors

Declare_Any_Class( "Ball",              // The following data members of a ball are filled in for you in Ray_Tracer::parse_line():
  { 'construct'( position, size, color, k_a, k_d, k_s, n, k_r, k_refract, refract_index )
      { this.define_data_members( { position, size, color, k_a, k_d, k_s, n, k_r, k_refract, refract_index } );
 
  // TODO:  Finish filling in data members, using data already present in the others.

        //getting started
        this.model_transform = identity();

        //basic settings for the ball with modification of position and size
        this.model_transform = mult(this.model_transform, translation(position[0], position[1], position[2]));
        this.model_transform = mult(this.model_transform, scale(size[0], size[1], size[2]));

        //important matrices that will be used when calculating normals later
        this.inverse_model_transform = inverse(this.model_transform);
        this.transpose_inverse_model_transform = transpose(inverse(this.model_transform));
      },
    'intersect'( ray, existing_intersection, minimum_dist )
      {
  // TODO:  Given a ray, check if this Ball is in its path.  Recieves as an argument a record of the nearest intersection found so far (a Ball pointer, a t distance
  //        value along the ray, and a normal), updates it if needed, and returns it.  Only counts intersections that are at least a given distance ahead along the ray.
  //        Tip:  Once intersect() is done, call it in trace() as you loop through all the spheres until you've found the ray's nearest available intersection.  Simply
  //        return a dummy color if the intersection tests positiv.  This will show the spheres' outlines, giving early proof that you did intersect() correctly.

        //mult the inverse matrix here
        var vec4S = mult_vec(this.inverse_model_transform, ray.origin);
        var vec4c = mult_vec(this.inverse_model_transform, ray.dir);
        var S = vec4S.slice(0, 3);
        var c = vec4c.slice(0, 3);
        //simplifying common terms which will be used in the quadratic calculation later
        var A = dot(c, c);
        var B = dot(S, c);
        var C = dot(S, S) - 1.0;
        var discriminant = B*B - A*C;
        var delta = Math.sqrt(discriminant);
        var t;
        var inside = false;

        // if (discriminant < 0) {
        //   return existing_intersection;
        // }

        if (discriminant == 0.0) {
          var t0 = -B/A;
          var inter_position = add(ray.origin.slice(0, 3), scale_vec(t0, ray.origin.slice(0, 3)));
          if (inter_position[2] < -1) {
            t = t0;
            if (t0 < minimum_dist || t0 >= existing_intersection.distance) {
              return existing_intersection;
            }
          }
          else {
            return existing_intersection;
          }
        }
        if (discriminant > 0) {
          var t1 = (-B/A) + (delta/A);
          var t2 = (-B/A) - (delta/A);
          var inter_position1 = add(ray.origin.slice(0, 3), scale_vec(t1, ray.dir.slice(0, 3)));
          var inter_position2 = add(ray.origin.slice(0, 3), scale_vec(t2, ray.dir.slice(0, 3)));
          if (inter_position1[2] >= -1 && inter_position2[2] >= -1) {
            return existing_intersection;
          }
          else {
            if (inter_position1[2] < -1 && inter_position2[2] >= -1) {
              inside = true;
              if (t1 < minimum_dist || t1 >= existing_intersection.distance) {
                return existing_intersection;
              }
              t = t1;
            }

            if (inter_position1[2] >= -1 && inter_position2[2] < -1) {
              inside = true;
              if (t2 < minimum_dist || t2 >= existing_intersection.distance) {
                return existing_intersection;
              }
              t = t2;
            }

            if (inter_position1[2] < -1 && inter_position2[2] < -1) {
              if (t1 >= t2) {
                t = t2;
              }
              else {
                t = t1;
              }
              if (t < minimum_dist || t >= existing_intersection.distance) {
                return existing_intersection;
              }
            }
          }
        }

        if (discriminant >= 0.0) {
          var fullray = add(vec4S, scale_vec(t, vec4c)); 
          var inter_norm = normalize(mult_vec(this.transpose_inverse_model_transform, fullray).slice(0, 3));
          inter_norm = inter_norm.concat(0);
          if (inside) {
          inter_norm = negate(inter_norm);
          }

          return {distance: t, ball: this, normal: inter_norm};
        }

        return existing_intersection;
      }
  } );

Declare_Any_Class( "Ray_Tracer",
  { 'construct'( context )
      { this.define_data_members( { width: 32, height: 32, near: 1, left: -1, right: 1, bottom: -1, top: 1, ambient: [.1, .1, .1],
                                    balls: [], lights: [], curr_background_function: "color", background_color: [0, 0, 0, 1 ],
                                    scanline: 0, visible: true, scratchpad: document.createElement('canvas'), gl: context.gl,
                                    shader: context.shaders_in_use["Phong_Model"] } );
        var shapes = { "square": new Square(),                  // For texturing with and showing the ray traced result
                       "sphere": new Subdivision_Sphere( 4 ) };   // For drawing with ray tracing turned off
        this.submit_shapes( context, shapes );

        this.texture = new Texture ( context.gl, "", false, false );           // Initial image source: Blank gif file
        this.texture.image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        context.textures_in_use[ "procedural" ]  =  this.texture;

        this.scratchpad.width = this.width;  this.scratchpad.height = this.height;
        this.imageData          = new ImageData( this.width, this.height );     // Will hold ray traced pixels waiting to be stored in the texture
        this.scratchpad_context = this.scratchpad.getContext('2d');             // A hidden canvas for assembling the texture

        this.background_functions =                 // These convert a ray into a color even when no balls were struck by the ray.
          { waves: function( ray )
            { return Color( .5*Math.pow( Math.sin( 2*ray.dir[0] ), 4 ) + Math.abs( .5*Math.cos( 8*ray.dir[0] + Math.sin( 10*ray.dir[1] ) + Math.sin( 10*ray.dir[2] ) ) ),
                            .5*Math.pow( Math.sin( 2*ray.dir[1] ), 4 ) + Math.abs( .5*Math.cos( 8*ray.dir[1] + Math.sin( 10*ray.dir[0] ) + Math.sin( 10*ray.dir[2] ) ) ),
                            .5*Math.pow( Math.sin( 2*ray.dir[2] ), 4 ) + Math.abs( .5*Math.cos( 8*ray.dir[2] + Math.sin( 10*ray.dir[1] ) + Math.sin( 10*ray.dir[0] ) ) ), 1 );
            },
            lasers: function( ray ) 
            { var u = Math.acos( ray.dir[0] ), v = Math.atan2( ray.dir[1], ray.dir[2] );
              return Color( 1 + .5 * Math.cos( 20 * ~~u  ), 1 + .5 * Math.cos( 20 * ~~v ), 1 + .5 * Math.cos( 8 * ~~u ), 1 );
            },
            mixture:     ( function( ray ) { return mult_3_coeffs( this.background_functions["waves" ]( ray ), 
                                                                   this.background_functions["lasers"]( ray ) ).concat(1); } ).bind( this ),
            ray_direction: function( ray ) { return Color( Math.abs( ray.dir[ 0 ] ), Math.abs( ray.dir[ 1 ] ), Math.abs( ray.dir[ 2 ] ), 1 );  },
            color:       ( function( ray ) { return this.background_color;  } ).bind( this )
          };       
        this.make_menu();
        this.load_case( "show_homework_spec" );
      },
    'get_dir'( ix, iy )   
      {
    // TODO:  Map an (x,y) pixel to a corresponding xyz vector that reaches the near plane.  If correct, everything under the "background effects" menu will now work. 

         //alpha and beta are the ratios
         var alpha = ix/this.width;
         var beta = iy/this.height;

         //iinterpolating using alpha and beta
         var x = alpha * this.right + (1 - alpha) * this.left;
         var y = beta * this.top + (1 - beta) * this.bottom;
         //view frustrum
         var z = -1 * this.near;

         return normalize(vec4( x, y, z, 0 ));
      },
    'color_missed_ray'( ray ) { return mult_3_coeffs( this.ambient, this.background_functions[ this.curr_background_function ] ( ray ) ).concat(1); },
    'trace'( ray, color_remaining, is_primary, light_to_check = null )
      {
    // TODO:  Given a ray, return the color in that ray's path.  The ray either originates from the camera itself or from a secondary reflection or refraction off of a
    //        ball.  Call Ball.prototype.intersect on each ball to determine the nearest ball struck, if any, and perform vector math (the Phong reflection formula)
    //        using the resulting intersection record to figure out the influence of light on that spot.  Recurse for reflections and refractions until the final color
    //        is no longer significantly affected by more bounces.
    //
    //        Arguments besides the ray include color_remaining, the proportion of brightness this ray can contribute to the final pixel.  Only if that's still
    //        significant, proceed with the current recursion, computing the Phong model's brightness of each color.  When recursing, scale color_remaining down by k_r
    //        or k_refract, multiplied by the "complement" (1-alpha) of the Phong color this recursion.  Use argument is_primary to indicate whether this is the original
    //        ray or a recursion.  Use the argument light_to_check when a recursive call to trace() is for computing a shadow ray.
  
        if( length( color_remaining ) < .3 )  return Color( 0, 0, 0, 1 );

        var closest_intersection = { distance: Number.POSITIVE_INFINITY, ball: null, normal: null }

        //there's a relationship between whether primary light source and the minimum distance
        if (is_primary) {
          for (let key of this.balls) {
            closest_intersection = key.intersect(ray, closest_intersection, 1.0);
          }
        }
        else {
          for (let key of this.balls) {
            closest_intersection = key.intersect(ray, closest_intersection, 0.0001);
          }
        }

        //get the ball that the closest intersection occurs on
        var inter_ball = closest_intersection.ball;
        //check whether its a shadow light
        var shadowflag = false;
        if (is_primary == false && light_to_check == false) {
          if (!inter_ball) {
            shadowflag = false;
          }
          else {
            shadowflag = true;
          }
          return shadowflag;
        }

        //if inter_ball not zero, then we calculte the pixel color using the ray tracing algorithm
        if (inter_ball != null) {
          //surface color
          var surface_color;
          var ambient_color = scale_vec(inter_ball.k_a, inter_ball.color).slice(0, 3);
          //first add ambient into surface color, waiting for other terms
          surface_color = ambient_color;

          var inter_light_obj = add(ray.origin.slice(0, 3), scale_vec(closest_intersection.distance, ray.dir.slice(0, 3)));
          var inter_norm = normalize(closest_intersection.normal.slice(0, 3));
          //the ray
          var ray_primary = normalize(subtract(inter_light_obj, ray.origin.slice(0, 3)));
          //the vision
          var V = normalize(subtract(ray.origin.slice(0, 3), inter_light_obj));

          //iterate each lights to calculate light source contribution
          for (let l of this.lights) {
            var ori_l = inter_light_obj;
            var vec4ori_l = ori_l.concat(1);

            var dir_l = subtract(l.position.slice(0, 3), ori_l);
            var vec4dir_l = dir_l.concat(0);

            var col_l = l.color.slice(0, 3);

            //check shadow light
            var is_shadow = this.trace({origin: vec4ori_l, dir: vec4dir_l}, color_remaining, false, false); 
            if (is_shadow == true) {
              continue;
            }

            //calculate diffuse color
            var L = normalize(dir_l);
            var n_L = dot(inter_norm, L);
            if (n_L > 0) {
              surface_color = add(surface_color, scale_vec(inter_ball.k_d * n_L, vec3(col_l[0] * inter_ball.color[0], col_l[1] * inter_ball.color[1], col_l[2] * inter_ball.color[2])).slice(0, 3));
            }

            //calculate specular color
            var r = normalize(subtract(scale_vec(2 * n_L, inter_norm.slice(0, 3)), L));
            var r_v = dot(r, V);
            if (r_v > 0) {
              surface_color = add(surface_color, scale_vec((inter_ball.k_s * Math.pow(r_v, inter_ball.n)), col_l).slice(0, 3));
            }
          }

          //minor place that will cause bugs
          //make sure rgb is within 0-1
          for (var i = 2; i >= 0; i--) {
            if (surface_color[i] > 1.0 || surface_color[i] < 0.0) {
              if (surface_color[i] > 1.0) {
                surface_color[i] = 1.0;
              }
              else {
                surface_color[i] = 0.0;
              }
            }
          }

          //
          //here we start to do recursive calculation over ray refraction and reflection
          //
          var remaining = subtract(vec3(1, 1, 1), surface_color.slice(0, 3));

          //
          //calculate reflection
          // 
          var R = normalize(subtract(scale_vec( 2*dot(inter_norm, V), inter_norm), V).concat(0));
          var ray_reflected = {origin: inter_light_obj.concat(1), dir: R}

          var recursive_reflect = this.trace(ray_reflected, mult_3_coeffs(scale_vec(inter_ball.k_r, color_remaining), remaining), false, true);
          var color_reflected = scale_vec(inter_ball.k_r, recursive_reflect.slice(0, 3));

          //
          //calculate refraction
          //
          var rindex = inter_ball.refract_index;
          var c = dot(scale_vec(-1, inter_norm), ray_primary);
          var r_L = scale_vec(rindex, ray_primary);
          var r_c = rindex * c;
          var under = 1 - rindex*rindex * (1 - c*c);
          //var longterm = Math.sqrt(1 - r*r * (1 - c*c));
          if (under < 0.0) {
            under = 0.0;
          }
          var longerterm = scale_vec(r_c - Math.sqrt(under), inter_norm);
          var anotherR = normalize(add(r_L, longerterm));
          var ray_refracted = {origin: inter_light_obj.concat(1), dir: anotherR.concat(0)}; 

          var recursive_refract = this.trace(ray_refracted, mult_3_coeffs(scale_vec(inter_ball.k_refract, color_remaining), remaining), false, true);
          var color_refracted = scale_vec(inter_ball.k_refract, recursive_refract.slice(0, 3));

          //go big or go home
          var difference = subtract(vec3(1, 1, 1), surface_color);
          var sum = add(color_reflected, color_refracted);
          var pixel_color = add(surface_color, vec3(difference[0]*sum[0], difference[1]*sum[1], difference[2]*sum[2])).concat(1);

          return pixel_color;
        }

        return this.color_missed_ray( ray );
      },
    'parse_line'( tokens )            // Load the lines from the textbox into variables
      { for( let i = 1; i < tokens.length; i++ ) tokens[i] = Number.parseFloat( tokens[i] );
        switch( tokens[0] )
          { case "NEAR":    this.near   = tokens[1];  break;
            case "LEFT":    this.left   = tokens[1];  break;
            case "RIGHT":   this.right  = tokens[1];  break;
            case "BOTTOM":  this.bottom = tokens[1];  break;
            case "TOP":     this.top    = tokens[1];  break;
            case "RES":     this.width             = tokens[1];   this.height            = tokens[2]; 
                            this.scratchpad.width  = this.width;  this.scratchpad.height = this.height; break;
            case "SPHERE":
              this.balls.push( new Ball( [tokens[1], tokens[2], tokens[3]], [tokens[4], tokens[5], tokens[6]], [tokens[7],tokens[8],tokens[9]], 
                                          tokens[10],tokens[11],tokens[12],  tokens[13],tokens[14],tokens[15],  tokens[16] ) ); break;
            case "LIGHT":   this.lights.push( new Light( [ tokens[1],tokens[2],tokens[3], 1 ], Color( tokens[4],tokens[5],tokens[6], 1 ),    10000000 ) ); break;
            case "BACK":    this.background_color = Color( tokens[1],tokens[2],tokens[3], 1 ); this.gl.clearColor.apply( this.gl, this.background_color ); break;
            case "AMBIENT": this.ambient = [tokens[1], tokens[2], tokens[3]];          
          }
      },
    'parse_file'()        // Move through the text lines
      { this.balls = [];   this.lights = [];
        this.scanline = 0; this.scanlines_per_frame = 1;                            // Begin at bottom scanline, forget the last image's speedup factor
        document.getElementById("progress").style = "display:inline-block;";        // Re-show progress bar
        this.camera_needs_reset = true;                                             // Reset camera
        var input_lines = document.getElementById( "input_scene" ).value.split("\n");
        for( let i of input_lines ) this.parse_line( i.split(/\s+/) );
      },
    'load_case'( i ) {   document.getElementById( "input_scene" ).value = test_cases[ i ];   },
    'make_menu'()
      { document.getElementById( "raytracer_menu" ).innerHTML = "<span style='white-space: nowrap'> \
          <button id='toggle_raytracing' class='dropbtn' style='background-color: #AF4C50'>Toggle Ray Tracing</button> \
          <button onclick='document.getElementById(\"myDropdown2\").classList.toggle(\"show\"); return false;' class='dropbtn' style='background-color: #8A8A4C'> \
          Select Background Effect</button><div  id='myDropdown2' class='dropdown-content'>  </div>\
          <button onclick='document.getElementById(\"myDropdown\" ).classList.toggle(\"show\"); return false;' class='dropbtn' style='background-color: #4C50AF'> \
          Select Test Case</button        ><div  id='myDropdown' class='dropdown-content'>  </div> \
          <button id='submit_scene' class='dropbtn'>Submit Scene Textbox</button> \
          <div id='progress' style = 'display:none;' ></div></span>";
        for( let i in test_cases )
          { var a = document.createElement( "a" );
            a.addEventListener("click", function() { this.load_case( i ); this.parse_file(); }.bind( this    ), false);
            a.innerHTML = i;
            document.getElementById( "myDropdown"  ).appendChild( a );
          }
        for( let j in this.background_functions )
          { var a = document.createElement( "a" );
            a.addEventListener("click", function() { this.curr_background_function = j;      }.bind( this, j ), false);
            a.innerHTML = j;
            document.getElementById( "myDropdown2" ).appendChild( a );
          }
        
        document.getElementById( "input_scene" ).addEventListener( "keydown", function(event) { event.cancelBubble = true; }, false );
        
        window.addEventListener( "click", function(event) {  if( !event.target.matches('.dropbtn') ) {    
          document.getElementById( "myDropdown"  ).classList.remove("show");
          document.getElementById( "myDropdown2" ).classList.remove("show"); } }, false );

        document.getElementById( "toggle_raytracing" ).addEventListener("click", this.toggle_visible.bind( this ), false);
        document.getElementById( "submit_scene"      ).addEventListener("click", this.parse_file.bind(     this ), false);
      },
    'toggle_visible'() { this.visible = !this.visible; document.getElementById("progress").style = "display:inline-block;" },
    'set_color'( ix, iy, color )                           // Sends a color to one pixel index of our final result
      { var index = iy * this.width + ix;
        this.imageData.data[ 4 * index     ] = 255.9 * color[0];    
        this.imageData.data[ 4 * index + 1 ] = 255.9 * color[1];    
        this.imageData.data[ 4 * index + 2 ] = 255.9 * color[2];    
        this.imageData.data[ 4 * index + 3 ] = 255;  
      },
    'init_keys'( controls ) { controls.add( "SHIFT+r", this, this.toggle_visible ); },
    'display'( graphics_state )
      { graphics_state.lights = this.lights;
        graphics_state.projection_transform = perspective(90, 1, 1, 1000);
        if( this.camera_needs_reset ) { graphics_state.camera_transform = identity(); this.camera_needs_reset = false; }
        
        if( !this.visible )                          // Raster mode, to draw the same shapes out of triangles when you don't want to trace rays
        { for( let b of this.balls ) this.shapes.sphere.draw( graphics_state, b.model_transform, this.shader.material( b.color.concat(1), b.k_a, b.k_d, b.k_s, b.n ) );
          this.scanline = 0;    document.getElementById("progress").style = "display:none";     return; 
        } 
        if( !this.texture || !this.texture.loaded ) return;      // Don't display until we've got our first procedural image
        this.scratchpad_context.drawImage( this.texture.image, 0, 0 );
        this.imageData = this.scratchpad_context.getImageData( 0, 0, this.width, this.height );    // Send the newest pixels over to the texture
        var camera_inv = inverse( graphics_state.camera_transform );
        
        var desired_milliseconds_per_frame = 100;
        if( ! this.scanlines_per_frame ) this.scanlines_per_frame = 1;
        var milliseconds_per_scanline = Math.max( graphics_state.animation_delta_time / this.scanlines_per_frame, 1 );
        this.scanlines_per_frame = desired_milliseconds_per_frame / milliseconds_per_scanline + 1;
        for( var i = 0; i < this.scanlines_per_frame; i++ )     // Update as many scanlines on the picture at once as we can, based on previous frame's speed
        { var y = this.scanline++;
          if( y >= this.height ) { this.scanline = 0; document.getElementById("progress").style = "display:none" };
          document.getElementById("progress").innerHTML = "Rendering ( " + 100 * y / this.height + "% )..."; 
          for ( var x = 0; x < this.width; x++ )
          { var ray = { origin: mult_vec( camera_inv, vec4(0, 0, 0, 1) ), dir: mult_vec( camera_inv, this.get_dir( x, y ) ) };   // Apply camera
            this.set_color( x, y, this.trace( ray, [1,1,1], true ) );                                    // ******** Trace a single ray *********
          }
        }
        this.scratchpad_context.putImageData( this.imageData, 0, 0);          // Draw the image on the hidden canvas
        this.texture.image.src = this.scratchpad.toDataURL("image/png");      // Convert the canvas back into an image and send to a texture
        
        this.shapes.square.draw( new Graphics_State( identity(), identity(), 0 ), translation(0,0,-1), this.shader.material( Color( 0, 0, 0, 1 ), 1,  0, 0, 1, this.texture ) );
      }
  }, Scene_Component );