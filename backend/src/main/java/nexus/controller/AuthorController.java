package nexus.controller;

import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin("*")
public class AuthorController {

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> request) {

        Map<String, Object> response = new HashMap<>();

        response.put("token", "demo-token");
        response.put("email", request.get("email"));
        response.put("message", "Login successful");

        return response;
    }
}